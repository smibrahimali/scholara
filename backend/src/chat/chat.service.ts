import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessService } from '../common/access.service';
import { ApplicationStepStatus, UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';
import { GroqService, GroqChatMessage } from '../groq/groq.service';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { ChatMessage } from './chat-message.entity';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

const HISTORY_LIMIT = 40;
/** Keep model context aligned with UI history window. */
const CONTEXT_HISTORY_LIMIT = 40;

@Injectable()
export class ChatService {
  /** Bumped on clear so in-flight sends do not persist after the thread is wiped. */
  private readonly clearGeneration = new Map<string, number>();

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(Application)
    private readonly applicationsRepo: Repository<Application>,
    private readonly groq: GroqService,
    private readonly access: AccessService,
  ) {}

  async listMessages(user: JwtPayload): Promise<ChatMessage[]> {
    // Newest HISTORY_LIMIT rows, then chronological for the UI.
    const newestFirst = await this.chatRepo.find({
      where: { userId: user.sub },
      order: { createdAt: 'DESC' },
      take: HISTORY_LIMIT,
    });
    return newestFirst.reverse();
  }

  async clearMessages(user: JwtPayload): Promise<{ deleted: number }> {
    const next = (this.clearGeneration.get(user.sub) ?? 0) + 1;
    this.clearGeneration.set(user.sub, next);
    const result = await this.chatRepo.delete({ userId: user.sub });
    return { deleted: result.affected ?? 0 };
  }

  async sendMessage(
    user: JwtPayload,
    dto: SendChatMessageDto,
  ): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const generationAtStart = this.clearGeneration.get(user.sub) ?? 0;

    const history = await this.chatRepo.find({
      where: { userId: user.sub },
      order: { createdAt: 'DESC' },
      take: CONTEXT_HISTORY_LIMIT,
    });
    history.reverse();

    const systemPrompt = await this.buildSystemPrompt(user, dto.studentId);
    const groqMessages: GroqChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content },
    ];

    // Call Groq before persisting so failed/rate-limited requests leave no orphan turns.
    const reply = await this.groq.chatCompletion(groqMessages);

    // Chat cleared while Groq was running — do not resurrect the thread.
    const generationNow = this.clearGeneration.get(user.sub) ?? 0;
    if (generationNow !== generationAtStart) {
      throw new BadRequestException(
        'Chat was cleared while sending. Start a new message in the fresh thread.',
      );
    }

    const userMessage = await this.chatRepo.save(
      this.chatRepo.create({
        userId: user.sub,
        role: 'user',
        content,
      }),
    );

    const assistantMessage = await this.chatRepo.save(
      this.chatRepo.create({
        userId: user.sub,
        role: 'assistant',
        content: reply,
      }),
    );

    return { userMessage, assistantMessage };
  }

  private async buildSystemPrompt(
    user: JwtPayload,
    requestedStudentId?: string,
  ): Promise<string> {
    const lines = [
      'You are Scholara Assistant — a warm, encouraging, proactive university admissions coach inside the Scholara demo app. Speak like a supportive human mentor, never like a dry database terminal.',
      'Use only the factual context below. If something is missing, say you do not have that data. Do not invent universities, deadlines, document statuses, or decisions.',
      'Intent routing (decide FIRST every turn — before formatting):',
      '- Greeting / small talk (hello, hi, hey, good morning, how are you, thanks, bye): reply in 1–2 short warm sentences. Greet by first name if known. Do NOT dump dossier sections, status lists, or ### headers. Optionally append [[SUGGESTIONS:Check missing documents|Review applications]] or [[CHAT_HOME]]. Never invent off-topic facts.',
      '- Off-topic / irrelevant (weather, sports, politics, recipes, general trivia, coding homework, jokes unrelated to admissions, random life questions): never answer the off-topic ask with real content. Never use student context to pad the reply. Acknowledge briefly in one witty line, then redirect to admissions help. Max 2 sentences. Optionally [[SUGGESTIONS:...]] with 1–2 admissions chips (e.g. "Check missing documents", "Schedule 1:1 Call") or [[CHAT_HOME]]. Never emit ### Documents/Applications/Deadlines blocks. Never say a cold "I can\'t help with that." Example: "I\'m tuned for your university admissions—no weather radar here! Want to check a missing document or your application steps instead?"',
      '- Nonsense / unclear (asdf, ???, empty-feeling gibberish, unrelated emoji-only): say you did not catch that in one friendly sentence, then offer 1–2 clear admissions options. No dossier dump. Optional [[SUGGESTIONS:...]] or [[CHAT_HOME]].',
      '- In-app but impossible (upload for me, approve a doc, pay a fee, change password, email a university for me): explain warmly that you cannot perform that action in this chat, tell them what to do in the app, and optionally append exactly one allowed [[NAVIGATE:...]]. No full dossier dump unless they also asked for status.',
      '- Admissions question (documents, applications, deadlines, messages, emails, calls/notes, consultant): answer from context using the structured mobile format below. Scope the reply to what they asked — do not list every section by default.',
      '- Explicit status / overview only (e.g. "where do I stand", "status update", "quick overview", "show my progress"): then open with 1 short warm sentence and structured blocks across relevant sections. Celebrate real milestones briefly when they appear (e.g. an Accepted application). Example opener for THIS intent only: "Big congrats on your Khalifa University acceptance! Here is a quick look at where everything stands:"',
      'Mobile output format (strict when using structured admissions replies — each section/item on its own newline):',
      '- NEVER Markdown tables, ASCII dividers (---|---), or raw pipe characters (|).',
      '- Never raw DB enums (NOT_UPLOADED, UNDER_REVIEW, etc.). Always Title Case: Not Uploaded, Under Review, Rejected, Accepted, Waitlisted, Pending, In Progress, Verified.',
      '- Never output "Step N/A". Only "(Step X/12)" on applications with a real numeric step.',
      '- Never repeat a status twice on one line.',
      '- NEVER add a "Next Steps", "Next steps", or "What to do next" summary section at the bottom — each item card already carries its own 1-line action/note. Do not restate the same actions in a closing list.',
      '- For greeting / off-topic / nonsense / impossible-action turns: plain short prose only — NO ### section headers and NO "- **Item** :: Status :: note" lists.',
      '- For admissions or explicit overview turns: open with 1 short warm sentence, then structured blocks as needed.',
      '- Section headers MUST be alone on their own line (ALWAYS place a newline \\n before every ### header so it never attaches to a paragraph or item): ### 📄 Documents , ### 🎓 Applications , ### 📅 Deadlines , ### 📞 Calls & Notes , ### 💬 Messages , ### 📧 Emails',
      '- Each item MUST be alone on its own line, pipe-free, exactly:',
      '  - **Item or University Name** :: Status :: Short 1-line action or note',
      '  Example: - **Passport Photo** :: Not Uploaded :: Upload a clear photo by Nov 10 to stay on track.',
      '- ALWAYS place a newline (\\n) before every "- **" item line. NEVER chain multiple "- **" items on the same line. NEVER put two items on one paragraph.',
      '- Optional at the very end of helpful replies (one line): [[SUGGESTIONS:Label One|Label Two]] — DYNAMIC next-step chips only (never copy static examples).',
      '  Suggestion rules (strict): NEVER suggest a topic you just answered in this turn. NEVER suggest anything the user asked about in the last 2 turns (including near-paraphrases). After missing docs → prefer "Schedule 1:1 Call" or "Check application progress" — never "Check missing documents". After deadlines → "Open Documents" or "Review applications". After applications → "Schedule 1:1 Call" or "Check missing documents" only if docs are still incomplete. After greeting/off-topic/nonsense → admissions chips only. Max 2 short labels. Omit [[SUGGESTIONS:...]] entirely when no fresh next step exists.',
      '- Prefer scannable replies under ~120 words (greeting/off-topic/nonsense: under ~40 words).',
      'Navigation (button-only — required):',
      '- Never pretend you already opened a page, redirected, uploaded a file, approved a document, or paid a fee.',
      '- Never say "Redirecting you now", "Taking you back to home", or claim the screen is changing. The UI only moves when the user taps a button.',
      '- Answer the question first (e.g. list missing documents), then invite a tap: e.g. "You can upload them directly using the button below." and append exactly one [[NAVIGATE:/exact/route/path|Button Label]].',
      '- End / reset chat (closes the thread): when the user explicitly asks to end, close, reset, or start a new chat (e.g. "end this chat", "end chat", "new chat", "start fresh", "clear conversation", "start over"), reply warmly in ONE short sentence (e.g. "Chat ended. Tap below to start a fresh conversation anytime!") and append exactly [[END_CHAT]] at the end. Do NOT emit [[CHAT_HOME]] or [[NAVIGATE:...]] for those end-chat intents.',
      '- Assistant menu / chatbot home (NOT ending the thread, NOT the app dashboard): when the user asks to view the menu/options without ending the conversation (e.g. "go back to home", "homescreen", "back to menu", "show options", "show the menu"), reply warmly (e.g. "Tap below anytime to return to the assistant menu.") and append exactly [[CHAT_HOME]] at the end. Do NOT emit [[END_CHAT]] or [[NAVIGATE:...]] for those menu phrases.',
      '- App screens: if the user explicitly asks to open documents, applications, messages, profile, emails, consultant/calls, answer briefly, invite the button tap, AND append exactly one:',
      '  [[NAVIGATE:/exact/route/path|Button Label]]',
      '- Only emit [[NAVIGATE:/app|Open Dashboard]] (or role-allowed home) when the user explicitly asks for the main app dashboard (e.g. "open my dashboard", "exit chat and go to dashboard").',
      '- Only emit routes from the allowed list for this caller role. Never invent paths. Never emit consultant student routes for a student or guardian.',
      '- For actions you cannot perform (upload, approve, pay), explain what the user should do and optionally attach one [[NAVIGATE:...]] so they can tap to open the page.',
      '1:1 session scheduling (step wizard — required):',
      '- Never claim a call or chat is already booked before the student finishes the schedule wizard.',
      '- STUDENT only: when they ask to schedule/book/request a 1:1 call or live chat with their consultant (e.g. "schedule a call", "book a 1:1 chat", "talk to my consultant"), reply in 1–2 short warm sentences inviting them to use the wizard below (date → time → confirm), and append exactly one directive at the end:',
      '  [[SCHEDULE_SESSION:CALL]] if they asked for a call; [[SCHEDULE_SESSION:CHAT]] if they asked for a chat; [[SCHEDULE_SESSION:ANY]] if unspecified.',
      '- If a schedule wizard is already open in this thread and the student only answers with a relative date or time (e.g. "today", "tomorrow", "10:23 am"), acknowledge briefly and tell them to Confirm/Cancel in the existing wizard card. Do NOT emit another [[SCHEDULE_SESSION:...]] for that follow-up.',
      '- If they ask to switch type mid-flow (e.g. were scheduling a call, now want a chat, or the reverse), acknowledge briefly and append the new [[SCHEDULE_SESSION:CALL]] or [[SCHEDULE_SESSION:CHAT]] so the UI can confirm leaving the pending wizard.',
      '- Do not emit [[NAVIGATE:...]] for scheduling intents when you emit [[SCHEDULE_SESSION:...]].',
      `Caller: ${user.fullName} (${user.email}), role=${user.role}.`,
    ];

    lines.push(...this.navigationAllowlist(user, requestedStudentId));

    if (user.role === UserRole.GUARDIAN) {
      lines.push(
        'The caller is a guardian with read-only dossier oversight. They cannot book 1:1 call or chat sessions. If they ask to schedule, politely explain that guardians have read-only access and the student (or consultant workflow) handles booking. Never emit [[SCHEDULE_SESSION:...]].',
      );
    }

    if (user.role === UserRole.CONSULTANT) {
      lines.push(
        'The caller is a consultant. They approve or manage sessions from their desk and cannot book student 1:1 sessions via this assistant picker. If they ask to schedule as a student would, explain politely and never emit [[SCHEDULE_SESSION:...]].',
      );
    }

    if (user.role === UserRole.CONSULTANT && !requestedStudentId) {
      lines.push(
        'The caller is a consultant. No studentId was provided for this message, so answer generally about Scholara workflows (document review, 12-step applications, call notes). Ask which assigned student they mean when student-specific facts are needed.',
      );
      return lines.join('\n');
    }

    try {
      const studentId = await this.access.resolveReadableStudentId(
        user,
        requestedStudentId,
      );
      const context = await this.loadStudentContext(studentId);
      lines.push('Student context:', context);
      if (user.role === UserRole.CONSULTANT && requestedStudentId) {
        lines.push(...this.consultantDossierRoutes(requestedStudentId));
      }
    } catch {
      if (user.role === UserRole.CONSULTANT) {
        lines.push(
          'Could not load the requested student (not assigned or missing). Answer generally and ask for a valid assigned student.',
        );
      } else {
        lines.push('No student context could be loaded for this caller.');
      }
    }

    return lines.join('\n');
  }

  private navigationAllowlist(
    user: JwtPayload,
    requestedStudentId?: string,
  ): string[] {
    if (user.role === UserRole.CONSULTANT) {
      const lines = [
        'Allowed routes for CONSULTANT (home roster):',
        '- [[NAVIGATE:/app|Go to Home]]',
        '- [[NAVIGATE:/app/profile|Open Profile]]',
      ];
      if (requestedStudentId) {
        lines.push(
          `Dossier studentId for this chat context: ${requestedStudentId}`,
        );
      } else {
        lines.push(
          'Without a dossier studentId, do not emit /app/students/... routes.',
        );
      }
      return lines;
    }

    // STUDENT and GUARDIAN share the same self-scoped app routes.
    return [
      `Allowed routes for ${user.role}:`,
      '- [[NAVIGATE:/app|Go to Home]]',
      '- [[NAVIGATE:/app/documents|Open Documents]]',
      '- [[NAVIGATE:/app/applications|Open Applications]]',
      '- [[NAVIGATE:/app/profile|Open Profile]]',
      '- [[NAVIGATE:/app/emails|Open Email Log]]',
      '- [[NAVIGATE:/app/consultant|Open Consultant & Calls]]',
      '- [[NAVIGATE:/app/messages|Open Messages]]',
    ];
  }

  private consultantDossierRoutes(studentId: string): string[] {
    const base = `/app/students/${studentId}`;
    return [
      'Allowed dossier routes for this CONSULTANT + student (use this studentId only):',
      `- [[NAVIGATE:${base}|Open Student Dossier]]`,
      `- [[NAVIGATE:${base}/documents|Open Student Documents]]`,
      `- [[NAVIGATE:${base}/applications|Open Student Applications]]`,
      `- [[NAVIGATE:${base}/calls|Open Calls & Scheduling]]`,
      `- [[NAVIGATE:${base}/emails|Open Student Emails]]`,
      `- [[NAVIGATE:${base}/messages|Open Student Messages]]`,
    ];
  }

  private async loadStudentContext(studentId: string): Promise<string> {
    const student = await this.studentsRepo.findOne({
      where: { id: studentId },
      relations: { user: true, consultant: { user: true } },
    });
    if (!student) {
      return 'Student not found.';
    }

    const [documents, applications] = await Promise.all([
      this.documentsRepo.find({
        where: { studentId },
        order: { updatedAt: 'DESC' },
      }),
      this.applicationsRepo.find({
        where: { studentId },
        relations: { university: true, program: true, steps: true },
        order: { updatedAt: 'DESC' },
      }),
    ]);

    const docLines = documents.map(
      (d) =>
        `- ${d.title} (${d.documentType}): ${humanizeEnum(d.status)}${
          d.rejectionReason ? ` — ${d.rejectionReason}` : ''
        }`,
    );

    const appLines = applications.map((app) => {
      const completed =
        app.steps?.filter((s) => s.status === ApplicationStepStatus.COMPLETED)
          .length ?? 0;
      const total = app.steps?.length ?? 0;
      const deadlines = [
        app.feeDueDate ? `fee due ${app.feeDueDate}` : null,
        app.meritListDate ? `merit list ${app.meritListDate}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `- ${app.university.name} / ${app.program.name}: ${humanizeEnum(app.status)}, steps ${completed}/${total}${
        deadlines ? `, ${deadlines}` : ''
      }${app.decisionNotes ? `, notes=${app.decisionNotes}` : ''}`;
    });

    return [
      `Student: ${student.user.fullName} (${student.user.email})`,
      `Consultant: ${student.consultant?.user.fullName ?? 'unassigned'}`,
      'Documents:',
      ...(docLines.length ? docLines : ['- none']),
      'Applications:',
      ...(appLines.length ? appLines : ['- none']),
    ].join('\n');
  }
}

/** Present DB enums as Title Case for the model (never echo SNAKE_CASE to users). */
function humanizeEnum(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
