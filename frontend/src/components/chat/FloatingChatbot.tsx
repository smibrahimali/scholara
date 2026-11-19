import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarPlus,
  Check,
  ClipboardList,
  FileWarning,
  Handshake,
  Home,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  NotebookPen,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { CrestMark } from '../ivy/CrestMark';
import { TapButton } from '../ivy/TapButton';
import {
  SessionSchedulerCard,
  type ScheduleWizardStatus,
} from './SessionSchedulerCard';
import { useAuth } from '../../context/AuthContext';
import {
  ENUM_TOKEN_RE,
  dedupeRepeatedStatusWords,
  hashSectionLabel,
  humanizeEnumToken,
  humanStatusTone,
  isAllowedNavigatePath,
  isBulletLine,
  isHashSectionHeader,
  isNextStepsSectionLabel,
  isSectionHeaderLine,
  normalizeAssistantMarkdown,
  hasChatHomeDirective,
  hasEndChatDirective,
  filterSuggestionChips,
  parseColonItem,
  parseNavigateDirectives,
  parseScheduleSession,
  parseSuggestions,
  sectionHeaderLabel,
  splitAssistantDisplayLines,
  statusEmojiFor,
  statusTone,
  stripAssistantDirectives,
  stripStepNA,
  type NavigateDirective,
  type ScheduleSessionMode,
  type StatusTone,
} from '../../lib/chatFormat';
import { cn } from '../../lib/cn';
import { withFrom } from '../../lib/navigation';
import {
  clearChatMessages,
  fetchChatMessages,
  sendChatMessage,
  type ChatMessageDto,
} from '../../services/chatApi';

type StarterTile = {
  title: string;
  hint: string;
  prompt: string;
  icon: typeof FileWarning;
};

const STUDENT_STARTERS: StarterTile[] = [
  {
    title: 'Missing Documents',
    hint: 'Uploads & review notes',
    prompt: 'Which documents are still missing or need attention?',
    icon: FileWarning,
  },
  {
    title: 'Upcoming Deadlines',
    hint: 'What is due next',
    prompt: 'What upcoming deadlines should I prioritize next?',
    icon: CalendarClock,
  },
  {
    title: 'Application Progress',
    hint: 'Steps & next moves',
    prompt: 'Summarize my application progress and what to do next.',
    icon: ClipboardList,
  },
  {
    title: 'Schedule 1:1 Call',
    hint: 'Pick a date & time',
    prompt: 'I would like to schedule a 1:1 audio call with my consultant.',
    icon: CalendarPlus,
  },
];

const GUARDIAN_STARTERS: StarterTile[] = [
  {
    title: 'Student overview',
    hint: 'Read-only progress snapshot',
    prompt: 'Give me a read-only overview of my student dossier and progress.',
    icon: ClipboardList,
  },
  {
    title: 'Document Status',
    hint: 'Verified, review, missing',
    prompt: 'What is the current document status for my linked student?',
    icon: FileWarning,
  },
  {
    title: 'Upcoming Deadlines',
    hint: 'What is coming up',
    prompt: 'What upcoming deadlines should we prioritize for my student?',
    icon: CalendarClock,
  },
  {
    title: 'Consultant Call Notes',
    hint: 'Session notes (view only)',
    prompt: 'Summarize recent consultant call notes for my linked student.',
    icon: NotebookPen,
  },
];

const CONSULTANT_STARTERS: StarterTile[] = [
  {
    title: 'Pending Document Reviews',
    hint: 'Awaiting your decision',
    prompt:
      'Which assigned students have documents pending review right now?',
    icon: FileWarning,
  },
  {
    title: 'Call & Chat Requests',
    hint: 'Pending session queue',
    prompt: 'Summarize pending call requests across my students.',
    icon: CalendarClock,
  },
  {
    title: 'Assigned Students Summary',
    hint: 'Portfolio snapshot',
    prompt: 'Give me a concise summary of my assigned students and priorities.',
    icon: Users,
  },
  {
    title: 'Handover Readiness',
    hint: 'Who needs a peer handoff',
    prompt:
      'Which students look ready for consultant handover and what should I check first?',
    icon: Handshake,
  },
];

function startersForRole(role?: string): StarterTile[] {
  if (role === 'GUARDIAN') return GUARDIAN_STARTERS;
  if (role === 'CONSULTANT') return CONSULTANT_STARTERS;
  return STUDENT_STARTERS;
}

function pathsMatch(current: string, target: string) {
  const normalize = (p: string) =>
    p.replace(/\/+$/, '') || '/';
  return normalize(current) === normalize(target);
}

function errorMessage(err: unknown, fallback: string) {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data
  ) {
    const msg = (err.response.data as { message: string | string[] }).message;
    return Array.isArray(msg) ? msg[0] : String(msg);
  }
  return fallback;
}

const STATUS_PILL_STYLES: Record<StatusTone, string> = {
  success: 'status-success',
  warning: 'status-warning font-semibold',
  danger: 'status-danger',
  muted: 'status-neutral',
};

function ItemStatusCard({
  title,
  status,
  note,
}: {
  title: string;
  status: string | null;
  note: string | null;
}) {
  const emoji = statusEmojiFor(status);
  return (
    <div className="space-y-1 rounded-xl border border-[#DFD4BE] bg-[#FFFDF9] p-3 shadow-[0_6px_20px_-6px_rgba(15,30,54,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[13px] font-semibold text-foreground">
          {emoji ? (
            <span className="mr-1.5" aria-hidden>
              {emoji}
            </span>
          ) : null}
          {title}
        </p>
        {status ? (
          <StatusPill
            label={status}
            tone={humanStatusTone(status)}
            compact
          />
        ) : null}
      </div>
      {note ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {formatInline(dedupeRepeatedStatusWords(note))}
        </p>
      ) : null}
    </div>
  );
}

/** Block-level cards — never inline spans that collapse newlines. */
function renderAssistantContent(content: string) {
  const normalized = stripStepNA(
    normalizeAssistantMarkdown(stripAssistantDirectives(content)),
  );
  const lines = splitAssistantDisplayLines(normalized);
  const nodes: ReactNode[] = [];
  let key = 0;
  let skippingNextSteps = false;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i] ?? '';
    if (!trimmed) continue;

    if (isHashSectionHeader(trimmed) || isSectionHeaderLine(trimmed)) {
      const label = isHashSectionHeader(trimmed)
        ? hashSectionLabel(trimmed)
        : sectionHeaderLabel(trimmed);
      if (isNextStepsSectionLabel(label)) {
        skippingNextSteps = true;
        continue;
      }
      skippingNextSteps = false;
      nodes.push(
        <div
          key={`section-${key++}`}
          className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wider text-muted-foreground first:mt-0"
        >
          {label}
        </div>,
      );
      continue;
    }

    if (skippingNextSteps) {
      continue;
    }

    const looksLikeItem =
      isBulletLine(trimmed) ||
      trimmed.includes('::') ||
      /^✅|^⏳|^⚠️|^⚠/.test(trimmed);

    if (looksLikeItem) {
      const item = parseColonItem(
        isBulletLine(trimmed) || trimmed.startsWith('-')
          ? trimmed
          : `- ${trimmed}`,
      );
      if (
        item &&
        (item.status ||
          item.note ||
          trimmed.includes('::') ||
          isBulletLine(trimmed))
      ) {
        let note = item.note;
        const next = lines[i + 1] ?? '';
        if (
          !note &&
          next &&
          !isBulletLine(next) &&
          !isHashSectionHeader(next) &&
          !isSectionHeaderLine(next) &&
          !next.includes('::') &&
          !/^\s*-\s+\*\*/.test(next) &&
          !/^\s*###\s+/.test(next)
        ) {
          note = dedupeRepeatedStatusWords(next);
          i += 1;
        }
        nodes.push(
          <ItemStatusCard
            key={`card-${key++}`}
            title={item.title}
            status={item.status}
            note={note}
          />,
        );
        continue;
      }
    }

    // Bare "Next Steps" paragraph without a ### header
    if (isNextStepsSectionLabel(trimmed.replace(/\*+/g, ''))) {
      skippingNextSteps = true;
      continue;
    }

    nodes.push(
      <div
        key={`p-${key++}`}
        className="whitespace-pre-line text-[13px] leading-relaxed text-foreground"
      >
        {formatInline(dedupeRepeatedStatusWords(trimmed))}
      </div>,
    );
  }

  if (nodes.length === 0) {
    return null;
  }

  return (
    <section className="w-full space-y-2.5 text-[13px] leading-snug text-foreground">
      {nodes}
    </section>
  );
}

function formatInline(text: string) {
  // Bold, then italic, then enum pills.
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(inner)) {
        return <StatusPill key={i} token={inner} />;
      }
      return (
        <strong key={i} className="font-semibold text-foreground">
          {formatItalicsAndEnums(inner)}
        </strong>
      );
    }
    return <span key={i}>{formatItalicsAndEnums(part)}</span>;
  });
}

function formatItalicsAndEnums(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (
      part.startsWith('*') &&
      part.endsWith('*') &&
      !part.startsWith('**') &&
      part.length > 2
    ) {
      const inner = part.slice(1, -1);
      // Italic human status → colored pill
      if (
        /^(Not Uploaded|Under Review|Waitlisted|Rejected|Accepted|Pending|In Progress|Verified|Approved|Completed|Action Needed)$/i.test(
          inner,
        )
      ) {
        return (
          <StatusPill
            key={i}
            label={inner}
            tone={humanStatusTone(inner)}
          />
        );
      }
      return (
        <em key={i} className="not-italic font-medium text-muted-foreground">
          {formatEnumTokens(inner)}
        </em>
      );
    }
    return <span key={i}>{formatEnumTokens(part)}</span>;
  });
}

function formatEnumTokens(text: string) {
  const nodes: ReactNode[] = [];
  let last = 0;
  ENUM_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENUM_TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(<StatusPill key={`${match.index}-${match[1]}`} token={match[1]!} />);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

function StatusPill({
  token,
  label,
  tone: toneOverride,
  compact = false,
}: {
  token?: string;
  label?: string;
  tone?: StatusTone;
  compact?: boolean;
}) {
  const tone = toneOverride ?? (token ? statusTone(token) : 'muted');
  const text = label ?? (token ? humanizeEnumToken(token) : '');
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full',
        compact
          ? 'px-2 py-0.5 text-[11px] font-medium'
          : 'mx-0.5 px-2 py-0.5 text-[11px] font-semibold',
        STATUS_PILL_STYLES[tone],
      )}
    >
      {text}
    </span>
  );
}

type ActiveScheduleState = {
  messageId: string;
  directiveMode: ScheduleSessionMode;
  kind: 'CALL' | null;
  incomplete: boolean;
  /** User cancelled this wizard — keep expired, do not remount. */
  dismissed: boolean;
};

function findLatestSchedule(
  messages: ChatMessageDto[],
  skipIds?: Set<string>,
): {
  index: number;
  id: string;
  mode: ScheduleSessionMode;
} | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;
    if (skipIds?.has(msg.id)) continue;
    const mode = parseScheduleSession(msg.content);
    if (!mode) continue;
    return { index: i, id: msg.id, mode };
  }
  return null;
}

function scheduleKindLabel(kind: 'CALL' | null | ScheduleSessionMode) {
  if (kind === 'CALL') return 'call';
  return 'call';
}

/** Any new schedule card while a wizard is incomplete needs an explicit handoff. */
function needsScheduleHandoff(
  active: ActiveScheduleState,
  next: { id: string; mode: ScheduleSessionMode },
): boolean {
  if (!active.incomplete || active.dismissed) return false;
  if (next.id === active.messageId) return false;
  return true;
}

function isCrossKindSwitch(
  currentKind: 'CALL' | null,
  nextMode: ScheduleSessionMode,
): boolean {
  if (!currentKind) return nextMode !== 'ANY' && nextMode !== 'CALL';
  if (nextMode === 'ANY') return false;
  return nextMode !== currentKind;
}

export function FloatingChatbot({ studentId }: { studentId?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showStarterHome, setShowStarterHome] = useState(true);
  const [activeSchedule, setActiveSchedule] =
    useState<ActiveScheduleState | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    messageId: string;
    mode: ScheduleSessionMode;
  } | null>(null);
  const [pendingNavigate, setPendingNavigate] =
    useState<NavigateDirective | null>(null);
  const [pendingEndChat, setPendingEndChat] = useState(false);
  const dismissedSwitchIdsRef = useRef<Set<string>>(new Set());
  /** Bumped on clear so late send successes cannot revive a wiped thread. */
  const chatEpochRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const welcomeStarters = startersForRole(user?.role);

  const messagesQuery = useQuery({
    queryKey: ['chat-messages'],
    queryFn: fetchChatMessages,
    enabled: open,
  });

  function resetScheduleTracking() {
    setActiveSchedule(null);
    setPendingSwitch(null);
    setPendingNavigate(null);
    setPendingEndChat(false);
    dismissedSwitchIdsRef.current.clear();
  }

  function goToDirective(directive: NavigateDirective) {
    if (
      !user ||
      !isAllowedNavigatePath(directive.path, user.role, studentId)
    ) {
      return;
    }
    // Mid-wizard: confirm before abandoning the schedule card.
    if (activeSchedule?.incomplete && !activeSchedule.dismissed) {
      setPendingNavigate(directive);
      return;
    }
    setPendingNavigate(null);
    setOpen(false);
    navigate(directive.path, withFrom(pathname));
  }

  function confirmLeaveWizardAndNavigate() {
    if (!pendingNavigate) return;
    const directive = pendingNavigate;
    if (activeSchedule) {
      dismissedSwitchIdsRef.current.add(activeSchedule.messageId);
      setActiveSchedule({
        ...activeSchedule,
        incomplete: false,
        dismissed: true,
      });
    }
    setPendingNavigate(null);
    setPendingSwitch(null);
    setOpen(false);
    navigate(directive.path, withFrom(pathname));
  }

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const epoch = chatEpochRef.current;
      const data = await sendChatMessage(content, studentId);
      return { data, epoch };
    },
    onSuccess: ({ data, epoch }) => {
      if (epoch !== chatEpochRef.current) return;
      // Mutation already returns both messages — update cache, skip redundant GET.
      queryClient.setQueryData<ChatMessageDto[]>(['chat-messages'], (prev) => {
        const list = prev ?? [];
        const next = [...list];
        if (!next.some((m) => m.id === data.userMessage.id)) {
          next.push(data.userMessage);
        }
        if (!next.some((m) => m.id === data.assistantMessage.id)) {
          next.push(data.assistantMessage);
        }
        return next;
      });
      setDraft('');
      // Never auto-navigate or switch views — user must tap an action button.
    },
    onError: (err) => {
      const msg = errorMessage(err, 'Chat failed');
      // Quiet when the thread was cleared mid-send (backend + epoch).
      if (/cleared while sending/i.test(msg)) return;
      toast.error(msg);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      chatEpochRef.current += 1;
      sendMutation.reset();
      await queryClient.cancelQueries({ queryKey: ['chat-messages'] });
      return clearChatMessages();
    },
    onSuccess: () => {
      queryClient.setQueryData<ChatMessageDto[]>(['chat-messages'], []);
      resetScheduleTracking();
      setShowStarterHome(true);
      setDraft('');
      toast.success('Chat cleared');
    },
    onError: () => toast.error('Could not clear chat'),
  });

  function startNewChat() {
    if (clearMutation.isPending) return;
    if (sendMutation.isPending) {
      chatEpochRef.current += 1;
      sendMutation.reset();
    }
    clearMutation.mutate();
  }

  function requestEndChat() {
    if (clearMutation.isPending) return;
    setShowStarterHome(false);
    setPendingEndChat(true);
  }

  function confirmEndChat() {
    setPendingEndChat(false);
    startNewChat();
  }

  const handleScheduleStatus = useCallback((status: ScheduleWizardStatus) => {
    setActiveSchedule((prev) =>
      prev
        ? {
            ...prev,
            incomplete: status.incomplete,
            kind: status.kind,
            dismissed: status.dismissed === true ? true : prev.dismissed,
          }
        : prev,
    );
  }, []);

  const messages = useMemo(
    () => messagesQuery.data ?? [],
    [messagesQuery.data],
  );
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;
    lastAssistantIndex = i;
    break;
  }
  const activeScheduleIndex = activeSchedule
    ? messages.findIndex((m) => m.id === activeSchedule.messageId)
    : -1;
  const viewingHome =
    showStarterHome ||
    (!messagesQuery.isLoading &&
      !messagesQuery.isError &&
      messages.length === 0);

  // Consultant dossier switch: wipe shared chat so contexts do not mix.
  const prevStudentIdRef = useRef(studentId);
  useEffect(() => {
    if (user?.role !== 'CONSULTANT') {
      prevStudentIdRef.current = studentId;
      return;
    }
    if (prevStudentIdRef.current === studentId) return;
    prevStudentIdRef.current = studentId;
    chatEpochRef.current += 1;
    sendMutation.reset();
    void clearChatMessages()
      .then(() => {
        queryClient.setQueryData<ChatMessageDto[]>(['chat-messages'], []);
        resetScheduleTracking();
        setShowStarterHome(true);
        setDraft('');
      })
      .catch(() => {
        /* best-effort */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on dossier change
  }, [studentId, user?.role]);

  useEffect(() => {
    if (messages.length === 0) {
      resetScheduleTracking();
      return;
    }
    const latest = findLatestSchedule(
      messages,
      dismissedSwitchIdsRef.current,
    );
    if (!latest) return;

    setActiveSchedule((prev) => {
      if (!prev) {
        return {
          messageId: latest.id,
          directiveMode: latest.mode,
          kind: latest.mode === 'ANY' ? null : 'CALL',
          incomplete: true,
          dismissed: false,
        };
      }
      const stillExists = messages.some((m) => m.id === prev.messageId);
      if (!stillExists) {
        return {
          messageId: latest.id,
          directiveMode: latest.mode,
          kind: latest.mode === 'ANY' ? null : 'CALL',
          incomplete: true,
          dismissed: false,
        };
      }
      // After cancel/complete, only adopt a *new* undismissed schedule message.
      if (
        (!prev.incomplete || prev.dismissed) &&
        latest.id !== prev.messageId
      ) {
        return {
          messageId: latest.id,
          directiveMode: latest.mode,
          kind: latest.mode === 'ANY' ? null : 'CALL',
          incomplete: true,
          dismissed: false,
        };
      }
      return prev;
    });
  }, [messages]);

  useEffect(() => {
    if (!activeSchedule?.incomplete || activeSchedule.dismissed) {
      setPendingSwitch(null);
      return;
    }
    const latest = findLatestSchedule(messages);
    if (!latest || latest.id === activeSchedule.messageId) {
      setPendingSwitch(null);
      return;
    }
    if (dismissedSwitchIdsRef.current.has(latest.id)) {
      setPendingSwitch(null);
      return;
    }
    // Stick to the first pending handoff until the user decides (anti-thrash).
    setPendingSwitch((prev) => {
      if (
        prev &&
        messages.some((m) => m.id === prev.messageId) &&
        !dismissedSwitchIdsRef.current.has(prev.messageId)
      ) {
        return prev;
      }
      if (needsScheduleHandoff(activeSchedule, latest)) {
        return { messageId: latest.id, mode: latest.mode };
      }
      return null;
    });
  }, [messages, activeSchedule]);

  useEffect(() => {
    if (!open || viewingHome) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    open,
    viewingHome,
    messages.length,
    sendMutation.isPending,
    pendingSwitch,
    pendingNavigate,
    pendingEndChat,
  ]);

  function sendContent(raw: string) {
    const content = raw.trim();
    if (!content || sendMutation.isPending || clearMutation.isPending) return;
    if (content.length > 4000) {
      toast.error('Message must be 4000 characters or fewer');
      return;
    }
    setShowStarterHome(false);
    sendMutation.mutate(content);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendContent(draft);
  }

  const deskLabel = studentId ? 'Student file desk' : 'Admissions desk';

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-0 z-[60] flex h-auto flex-col overflow-hidden rounded-none border-0 bg-background"
            style={{ bottom: 'var(--chrome-bottom)' }}
          >
            <header className="flex shrink-0 items-center justify-between gap-2 bg-[#111827] px-4 py-3 text-white">
              <div className="flex min-w-0 items-center gap-2.5">
                <CrestMark size={28} />
                <div className="min-w-0">
                  <p className="editorial-title truncate text-sm tracking-tight text-white">
                    Scholara Assistant
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-slate-300">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        messagesQuery.isError || sendMutation.isError
                          ? 'bg-amber-400'
                          : sendMutation.isPending
                            ? 'animate-pulse bg-gold'
                            : 'bg-emerald-400',
                      )}
                      aria-hidden
                    />
                    <span className="truncate">
                      {messagesQuery.isError || sendMutation.isError
                        ? `Unavailable · ${deskLabel}`
                        : sendMutation.isPending
                          ? `Thinking · ${deskLabel}`
                          : `Online · ${deskLabel}`}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <TapButton
                  aria-label="Assistant home menu"
                  className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
                  onClick={() => setShowStarterHome(true)}
                >
                  <Home className="h-4 w-4 text-inherit" strokeWidth={1.5} />
                </TapButton>
                <TapButton
                  aria-label="Clear chat"
                  className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  onClick={requestEndChat}
                  disabled={clearMutation.isPending || messages.length === 0}
                >
                  <Trash2 className="h-4 w-4 text-inherit" strokeWidth={1.5} />
                </TapButton>
                <TapButton
                  aria-label="Close chat"
                  className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4 text-inherit" strokeWidth={1.5} />
                </TapButton>
              </div>
            </header>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
              {messagesQuery.isLoading ? (
                <p className="px-4 py-6 text-center text-xs font-semibold text-muted-foreground">
                  Loading conversation…
                </p>
              ) : null}
              {messagesQuery.isError ? (
                <p className="px-4 py-6 text-center text-xs font-semibold text-destructive">
                  Could not load chat history. Try again shortly.
                </p>
              ) : null}

              {viewingHome &&
              !messagesQuery.isLoading &&
              !messagesQuery.isError ? (
                <div className="flex flex-col px-4 py-5">
                  <div className="flex flex-col items-center pt-2 text-center">
                    <CrestMark size={44} />
                    <h2 className="mt-3 font-sans text-lg font-semibold leading-snug tracking-tight text-[#1E2430]">
                      How can I help with your file?
                    </h2>
                    <p className="mt-1.5 max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
                      {user?.role === 'CONSULTANT'
                        ? 'Ask about reviews, requests, students, or handovers.'
                        : user?.role === 'GUARDIAN'
                          ? 'Read-only overview of documents, deadlines, and notes.'
                          : 'Ask about documents, deadlines, or application steps.'}
                    </p>
                  </div>

                  <div className="mt-5 pb-1">
                    <div className="grid grid-cols-2 gap-2.5">
                      {welcomeStarters.map(({ title, hint, prompt, icon: Icon }) => (
                        <TapButton
                          key={title}
                          type="button"
                          disabled={sendMutation.isPending}
                          onClick={() => sendContent(prompt)}
                          className="btn-outline flex min-h-[5.75rem] flex-col items-start gap-2 rounded-xl px-3 py-3 text-left transition active:scale-[0.98]"
                        >
                          <span className="ivy-medallion flex h-8 w-8 items-center justify-center rounded-lg">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[12px] font-semibold leading-tight text-foreground">
                              {title}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                              {hint}
                            </span>
                          </span>
                        </TapButton>
                      ))}
                    </div>
                    {messages.length > 0 ? (
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <TapButton
                          type="button"
                          onClick={() => setShowStarterHome(false)}
                          className="flex items-center justify-center gap-1.5 rounded-full bg-[#111827] px-3 py-2 text-[11px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Resume chat
                          <ArrowRight className="h-3 w-3" />
                        </TapButton>
                        <TapButton
                          type="button"
                          onClick={startNewChat}
                          disabled={clearMutation.isPending}
                          className="flex items-center justify-center gap-1 rounded-full border border-[#D5C8B0] bg-[#FFFDF9] px-3 py-2 text-[11px] font-semibold text-[#0F1E36] hover:bg-[#F7F2E7]"
                        >
                          <MessageSquarePlus className="h-3 w-3" />
                          {clearMutation.isPending ? 'Starting…' : 'New chat'}
                        </TapButton>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!viewingHome &&
              !messagesQuery.isLoading &&
              !messagesQuery.isError ? (
                <div className="space-y-3 px-4 py-4">
                  {studentId && messages.length > 0 ? (
                    <p className="rounded-lg bg-secondary/80 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground">
                      Context is this student. Chat history is yours across
                      dossiers — clear if switching topics.
                    </p>
                  ) : null}
                  {messages.map((msg, idx) => {
                    const priorUserMessages: string[] = [];
                    for (let i = idx - 1; i >= 0 && priorUserMessages.length < 2; i -= 1) {
                      const prev = messages[i];
                      if (prev?.role === 'user' && prev.content) {
                        priorUserMessages.unshift(prev.content);
                      }
                    }
                    return (
                      <ChatBubble
                        key={msg.id}
                        message={msg}
                        priorUserMessages={priorUserMessages}
                        currentPath={pathname}
                        onNavigate={goToDirective}
                        onChatHome={() => setShowStarterHome(true)}
                        onStartNewChat={requestEndChat}
                        startNewChatPending={clearMutation.isPending}
                        canNavigate={(path) =>
                          Boolean(
                            user &&
                              isAllowedNavigatePath(
                                path,
                                user.role,
                                studentId,
                              ),
                          )
                        }
                        canBookSession={user?.role === 'STUDENT'}
                        userRole={user?.role}
                        showSuggestions={idx === lastAssistantIndex}
                        scheduleActive={
                          activeScheduleIndex >= 0 &&
                          idx === activeScheduleIndex &&
                          !activeSchedule?.dismissed
                        }
                        scheduleDateHint={
                          activeScheduleIndex >= 0 &&
                          idx === activeScheduleIndex &&
                          !activeSchedule?.dismissed
                            ? collectScheduleDateHints(messages, idx)
                            : ''
                        }
                        onScheduleStatusChange={handleScheduleStatus}
                        onSuggest={sendContent}
                        suggestDisabled={sendMutation.isPending}
                      />
                    );
                  })}
                  {pendingSwitch && activeSchedule ? (
                    <div className="space-y-3 rounded-2xl border border-[#E6D3A3] bg-[#FFFDF9] p-3.5 shadow-elev1">
                      <p className="text-[13px] font-semibold leading-snug text-[#0F1E36]">
                        {isCrossKindSwitch(
                          activeSchedule.kind,
                          pendingSwitch.mode,
                        )
                          ? `Leave pending ${scheduleKindLabel(activeSchedule.kind)} request?`
                          : 'Replace current schedule wizard?'}
                      </p>
                      <p className="text-xs leading-relaxed text-[#525B6B]">
                        {isCrossKindSwitch(
                          activeSchedule.kind,
                          pendingSwitch.mode,
                        )
                          ? `You still have a ${scheduleKindLabel(activeSchedule.kind)} scheduling wizard in progress. Leave it and start a ${scheduleKindLabel(pendingSwitch.mode)} instead?`
                          : `You already have a ${scheduleKindLabel(activeSchedule.kind)} scheduling wizard in progress. Replace it with this new request?`}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <TapButton
                          type="button"
                          onClick={() => {
                            dismissedSwitchIdsRef.current.add(
                              pendingSwitch.messageId,
                            );
                            setPendingSwitch(null);
                          }}
                          className="btn-chip flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium"
                        >
                          <X className="h-3.5 w-3.5 shrink-0" />
                          No, keep it
                        </TapButton>
                        <TapButton
                          type="button"
                          onClick={() => {
                            const next = pendingSwitch;
                            dismissedSwitchIdsRef.current.add(
                              activeSchedule.messageId,
                            );
                            setPendingSwitch(null);
                            setPendingNavigate(null);
                            setActiveSchedule({
                              messageId: next.messageId,
                              directiveMode: next.mode,
                              kind: next.mode === 'ANY' ? null : 'CALL',
                              incomplete: true,
                              dismissed: false,
                            });
                          }}
                          className="btn-primary flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold"
                        >
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          Yes, replace
                        </TapButton>
                      </div>
                    </div>
                  ) : null}
                  {pendingNavigate && activeSchedule?.incomplete ? (
                    <div className="space-y-3 rounded-2xl border border-[#E6D3A3] bg-[#FFFDF9] p-3.5 shadow-elev1">
                      <p className="text-[13px] font-semibold leading-snug text-[#0F1E36]">
                        Leave scheduling to open {pendingNavigate.label}?
                      </p>
                      <p className="text-xs leading-relaxed text-[#525B6B]">
                        You still have a{' '}
                        {scheduleKindLabel(activeSchedule.kind)} wizard in
                        progress. Leave it and go to this page?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <TapButton
                          type="button"
                          onClick={() => setPendingNavigate(null)}
                          className="btn-chip flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium"
                        >
                          <X className="h-3.5 w-3.5 shrink-0" />
                          Stay here
                        </TapButton>
                        <TapButton
                          type="button"
                          onClick={confirmLeaveWizardAndNavigate}
                          className="btn-primary flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold"
                        >
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          Leave & open
                        </TapButton>
                      </div>
                    </div>
                  ) : null}
                  {pendingEndChat ? (
                    <div className="space-y-3 rounded-2xl border border-[#E6D3A3] bg-[#FFFDF9] p-3.5 shadow-elev1">
                      <p className="text-[13px] font-semibold leading-snug text-[#0F1E36]">
                        Start a new chat?
                      </p>
                      <p className="text-xs leading-relaxed text-[#525B6B]">
                        This clears the current conversation so you can begin
                        fresh. You can still open the assistant menu anytime.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <TapButton
                          type="button"
                          onClick={() => setPendingEndChat(false)}
                          className="btn-chip flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-medium"
                        >
                          <X className="h-3.5 w-3.5 shrink-0" />
                          Keep chatting
                        </TapButton>
                        <TapButton
                          type="button"
                          disabled={clearMutation.isPending}
                          onClick={confirmEndChat}
                          className="btn-primary flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
                          {clearMutation.isPending ? 'Starting…' : 'New chat'}
                        </TapButton>
                      </div>
                    </div>
                  ) : null}
                  {sendMutation.isPending ? (
                    <div className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <span className="flex gap-1" aria-hidden>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:300ms]" />
                      </span>
                      Reviewing dossier…
                    </div>
                  ) : null}
                  <div ref={bottomRef} />
                </div>
              ) : null}
            </div>

            {viewingHome && messages.length > 0 ? (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-background/95 px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Menu open — resume chat to keep typing.
                </p>
                <TapButton
                  type="button"
                  onClick={() => setShowStarterHome(false)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-medium text-white"
                >
                  Resume
                  <ArrowRight className="h-3 w-3" />
                </TapButton>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-background/95 px-3 py-2.5"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
                  rows={1}
                  maxLength={4000}
                  disabled={sendMutation.isPending}
                  placeholder={
                    viewingHome ? 'Or type a question…' : 'Ask Scholara…'
                  }
                  className="max-h-24 min-h-10 flex-1 resize-none rounded-full border border-[#EBE8E0] bg-[#F3F2F0] px-4 py-2.5 text-sm text-[#1E2430] shadow-well outline-none focus:border-[#C8963E] focus:bg-white focus:shadow-[0_0_0_2px_rgba(200,150,62,0.2)] disabled:border-[#EBE8E0] disabled:bg-[#F3F2F0] disabled:text-[#9CA3AF]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(e);
                    }
                  }}
                />
                <TapButton
                  type="submit"
                  disabled={!draft.trim() || sendMutation.isPending}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors',
                    draft.trim()
                      ? 'border-transparent bg-[#0F1E36] text-[#E6C365] shadow-xs'
                      : 'border-[#E2D8C5] bg-[#EFE9DC] text-[#9A8F7D]',
                  )}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </TapButton>
              </form>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!open ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          aria-label="Open Scholara assistant"
          onClick={() => setOpen(true)}
          className="absolute right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-[#111827] text-white shadow-fab transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-[1px] active:shadow-none"
          style={{ bottom: 'var(--fab-bottom)' }}
        >
          <MessageCircle className="h-[1.15rem] w-[1.15rem] text-white" strokeWidth={1.5} />
        </motion.button>
      ) : null}
    </>
  );
}

function scheduleRoleNote(role?: string) {
  if (role === 'GUARDIAN') {
    return 'Guardians have read-only dossier oversight and cannot book 1:1 sessions directly. Ask your student to schedule, or follow updates on their consultant requests.';
  }
  if (role === 'CONSULTANT') {
    return 'Consultants approve and manage 1:1 sessions from the desk — this booking picker is for students only.';
  }
  return 'Only students can book 1:1 audio calls from this assistant. Use Messages for everyday chat with your consultant.';
}

/**
 * User texts for schedule hints — scoped so later unrelated chat cannot re-drive the wizard.
 * - up to 2 user turns immediately before the schedule card
 * - only the latest user turn after it, and only until the next assistant message
 */
function collectScheduleDateHints(
  messages: ChatMessageDto[],
  scheduleIndex: number,
): string {
  const parts: string[] = [];
  for (
    let i = scheduleIndex - 1;
    i >= 0 && parts.length < 2;
    i -= 1
  ) {
    const prev = messages[i];
    if (prev?.role === 'assistant') break;
    if (prev?.role === 'user' && prev.content.trim()) {
      parts.unshift(prev.content.trim());
    }
  }
  let latestAfter: string | null = null;
  for (let i = scheduleIndex + 1; i < messages.length; i += 1) {
    const next = messages[i];
    if (next?.role === 'assistant') break;
    if (next?.role === 'user' && next.content.trim()) {
      latestAfter = next.content.trim();
    }
  }
  if (latestAfter) parts.push(latestAfter);
  return parts.join('\n');
}

function ChatBubble({
  message,
  priorUserMessages = [],
  currentPath,
  onNavigate,
  onChatHome,
  onStartNewChat,
  startNewChatPending = false,
  canNavigate,
  canBookSession = false,
  userRole,
  showSuggestions = false,
  scheduleActive = false,
  scheduleDateHint = '',
  onScheduleStatusChange,
  onSuggest,
  suggestDisabled = false,
}: {
  message: ChatMessageDto;
  priorUserMessages?: string[];
  currentPath: string;
  onNavigate: (directive: NavigateDirective) => void;
  onChatHome: () => void;
  onStartNewChat: () => void;
  startNewChatPending?: boolean;
  canNavigate: (path: string) => boolean;
  canBookSession?: boolean;
  userRole?: string;
  showSuggestions?: boolean;
  scheduleActive?: boolean;
  scheduleDateHint?: string;
  onScheduleStatusChange?: (status: ScheduleWizardStatus) => void;
  onSuggest?: (prompt: string) => void;
  suggestDisabled?: boolean;
}) {
  const isUser = message.role === 'user';
  const navigateDirectives = !isUser
    ? parseNavigateDirectives(message.content)
    : [];
  const directive =
    navigateDirectives.find(
      (d) => canNavigate(d.path) && !pathsMatch(currentPath, d.path),
    ) ?? null;
  const showNav = directive !== null;
  const showChatHome =
    !isUser && hasChatHomeDirective(message.content);
  const showEndChat = !isUser && hasEndChatDirective(message.content);
  const scheduleMode = !isUser
    ? parseScheduleSession(message.content)
    : null;
  const suggestions =
    !isUser && showSuggestions
      ? filterSuggestionChips(parseSuggestions(message.content), {
          priorUserMessages,
          assistantContent: message.content,
        })
      : [];
  const hasFooterActions =
    showNav || showChatHome || showEndChat || suggestions.length > 0;

  if (isUser) {
    return (
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#0B1528] px-3 py-2.5 text-sm leading-snug text-[oklch(0.98_0.01_85)]">
        <p className="whitespace-pre-wrap font-semibold">{message.content}</p>
      </div>
    );
  }

  // Assistant: full-width flat stack — no nested outer bubble.
  return (
    <div className="w-full space-y-2.5">
      {renderAssistantContent(message.content)}
      {scheduleMode ? (
        !canBookSession ? (
          <div className="rounded-2xl border border-[#EBE8E0]/80 bg-white p-3.5 text-xs leading-relaxed text-[#8B92A5] shadow-elev1">
            {scheduleRoleNote(userRole)}
          </div>
        ) : scheduleActive ? (
          <SessionSchedulerCard
            mode={scheduleMode}
            canBook={canBookSession}
            roleNote={scheduleRoleNote(userRole)}
            onCancel={onChatHome}
            onStatusChange={onScheduleStatusChange}
            dateHintText={scheduleDateHint}
          />
        ) : (
          <div className="rounded-xl border border-[#E2D7C1] bg-[#F7F2E7] px-3.5 py-3 text-xs font-medium leading-relaxed text-[#525B6B]">
            This schedule request is no longer active — ask again anytime to
            book a new time
          </div>
        )
      ) : null}
      {hasFooterActions ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {showNav && directive ? (
            <TapButton
              type="button"
              onClick={() => onNavigate(directive)}
              className="btn-primary inline-flex max-w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <span className="truncate">{directive.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </TapButton>
          ) : null}
          {showChatHome ? (
            <TapButton
              type="button"
              onClick={onChatHome}
              className="btn-outline inline-flex max-w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <Home className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Assistant Home Menu</span>
            </TapButton>
          ) : null}
          {showEndChat ? (
            <TapButton
              type="button"
              onClick={onStartNewChat}
              disabled={startNewChatPending}
              className="btn-metallic inline-flex max-w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {startNewChatPending ? 'Starting…' : 'Start New Chat'}
              </span>
            </TapButton>
          ) : null}
          {suggestions.length > 0 && onSuggest
            ? suggestions.map((label) => (
                <TapButton
                  key={label}
                  type="button"
                  disabled={suggestDisabled}
                  onClick={() => onSuggest(label)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#DEC484] bg-[#FFFDF9] px-3.5 py-1.5 text-xs font-semibold text-[#0F1E36] shadow-2xs active:scale-[0.98] hover:bg-[#FBF3DF]"
                >
                  <Sparkles className="h-3 w-3 shrink-0 text-[#C8963E]" />
                  {label}
                </TapButton>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
