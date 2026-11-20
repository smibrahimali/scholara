import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { CrestMark } from '../ivy/CrestMark';
import { TapButton } from '../ivy/TapButton';
import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { QuickActionCard } from './QuickActionCard';
import {
  SessionSchedulerCard,
  type ScheduleWizardStatus,
} from './SessionSchedulerCard';
import { SuggestionChips } from './SuggestionChips';
import { TypingIndicator } from './TypingIndicator';
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
import { chatMessagesKey } from '../../lib/queryKeys';
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
    title: 'Missing Docs',
    hint: 'Uploads & review notes',
    prompt: 'Which documents are still missing or need attention?',
    icon: FileWarning,
  },
  {
    title: 'Deadlines',
    hint: 'What is due next',
    prompt: 'What upcoming deadlines should I prioritize next?',
    icon: CalendarClock,
  },
  {
    title: 'My Progress',
    hint: 'Steps & next moves',
    prompt: 'Summarize my application progress and what to do next.',
    icon: ClipboardList,
  },
  {
    title: 'Book a Call',
    hint: 'Pick a date & time',
    prompt: 'I would like to schedule a 1:1 audio call with my consultant.',
    icon: CalendarPlus,
  },
];

const GUARDIAN_STARTERS: StarterTile[] = [
  {
    title: 'Overview',
    hint: 'Read-only progress snapshot',
    prompt: 'Give me a read-only overview of my student dossier and progress.',
    icon: ClipboardList,
  },
  {
    title: 'Documents',
    hint: 'Verified, review, missing',
    prompt: 'What is the current document status for my linked student?',
    icon: FileWarning,
  },
  {
    title: 'Deadlines',
    hint: 'What is coming up',
    prompt: 'What upcoming deadlines should we prioritize for my student?',
    icon: CalendarClock,
  },
  {
    title: 'Progress',
    hint: 'Steps & decisions on record',
    prompt:
      'Summarize my linked student application progress from the Scholara record.',
    icon: NotebookPen,
  },
];

const CONSULTANT_STARTERS: StarterTile[] = [
  {
    title: 'Pending Reviews',
    hint: 'Awaiting your decision',
    prompt:
      'Which assigned students have documents pending review right now?',
    icon: FileWarning,
  },
  {
    title: 'Rejected Docs',
    hint: 'Needs student re-upload',
    prompt:
      'Which assigned students have rejected documents that still need attention?',
    icon: FileWarning,
  },
  {
    title: 'My Students',
    hint: 'Portfolio snapshot',
    prompt: 'Give me a concise summary of my assigned students and priorities.',
    icon: Users,
  },
  {
    title: 'Open a File',
    hint: 'Deep dive in a dossier',
    prompt:
      'Remind me how to open a student dossier for detailed documents and applications.',
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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [showScrollLatest, setShowScrollLatest] = useState(false);
  const dismissedSwitchIdsRef = useRef<Set<string>>(new Set());
  /** Bumped on clear so late send successes cannot revive a wiped thread. */
  const chatEpochRef = useRef(0);
  const sendAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const wasOpenRef = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const welcomeStarters = startersForRole(user?.role);
  const messagesKey = chatMessagesKey(studentId);

  const closeChat = useCallback(() => {
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    setOpen(false);
  }, []);

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => fetchChatMessages(studentId),
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
      sendAbortRef.current?.abort();
      const controller = new AbortController();
      sendAbortRef.current = controller;
      try {
        const data = await sendChatMessage(content, studentId, {
          signal: controller.signal,
        });
        return { data, epoch };
      } finally {
        if (sendAbortRef.current === controller) {
          sendAbortRef.current = null;
        }
      }
    },
    onSuccess: ({ data, epoch }) => {
      if (epoch !== chatEpochRef.current) return;
      // Mutation already returns both messages — update cache, skip redundant GET.
      queryClient.setQueryData<ChatMessageDto[]>(messagesKey, (prev) => {
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
    onError: (err, content) => {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'ERR_CANCELED'
      ) {
        return;
      }
      const msg = errorMessage(err, 'Chat failed');
      // Quiet when the thread was cleared mid-send (backend + epoch).
      if (/cleared while sending/i.test(msg)) return;
      setLastFailedPrompt(content);
      toast.error(msg);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      chatEpochRef.current += 1;
      sendAbortRef.current?.abort();
      sendAbortRef.current = null;
      sendMutation.reset();
      await queryClient.cancelQueries({ queryKey: messagesKey });
      return clearChatMessages(studentId);
    },
    onSuccess: () => {
      queryClient.setQueryData<ChatMessageDto[]>(messagesKey, []);
      resetScheduleTracking();
      setShowStarterHome(true);
      setDraft('');
      setLastFailedPrompt(null);
      setClearConfirmOpen(false);
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

  // Consultant dossier switch: threads are server-scoped by studentId — reset local UI only.
  const prevStudentIdRef = useRef(studentId);
  useEffect(() => {
    if (user?.role !== 'CONSULTANT') {
      prevStudentIdRef.current = studentId;
      return;
    }
    if (prevStudentIdRef.current === studentId) return;
    prevStudentIdRef.current = studentId;
    chatEpochRef.current += 1;
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    sendMutation.reset();
    resetScheduleTracking();
    setShowStarterHome(true);
    setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on dossier change
  }, [studentId, user?.role]);

  useEffect(() => {
    return () => {
      sendAbortRef.current?.abort();
      sendAbortRef.current = null;
    };
  }, []);

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
    if (showScrollLatest) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    open,
    viewingHome,
    messages.length,
    sendMutation.isPending,
    lastFailedPrompt,
    pendingSwitch,
    pendingNavigate,
    pendingEndChat,
    showScrollLatest,
  ]);

  // Lock background page scroll while the assistant covers the shell.
  useEffect(() => {
    if (!open) return;
    const main = document.getElementById('scholara-main');
    const prevOverflow = main?.style.overflow ?? '';
    if (main) main.style.overflow = 'hidden';
    return () => {
      if (main) main.style.overflow = prevOverflow;
    };
  }, [open]);

  // Escape closes confirm first, then the panel; focus moves to input on open.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      const focusTimer = window.setTimeout(() => {
        composerInputRef.current?.focus();
      }, 40);
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (clearConfirmOpen) {
          setClearConfirmOpen(false);
          return;
        }
        if (pendingEndChat) {
          setPendingEndChat(false);
          return;
        }
        closeChat();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => {
        window.clearTimeout(focusTimer);
        window.removeEventListener('keydown', onKeyDown);
      };
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      setClearConfirmOpen(false);
      const focusTimer = window.setTimeout(() => {
        launcherRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(focusTimer);
    }
    return undefined;
  }, [open, closeChat, clearConfirmOpen, pendingEndChat]);

  function sendContent(raw: string) {
    const content = raw.trim();
    if (!content || sendMutation.isPending || clearMutation.isPending) return;
    if (content.length > 4000) {
      toast.error('Message must be 4000 characters or fewer');
      return;
    }
    setLastFailedPrompt(null);
    setShowScrollLatest(false);
    setShowStarterHome(false);
    sendMutation.mutate(content);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendContent(draft);
  }

  function scrollToLatest(behavior: ScrollBehavior = 'smooth') {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowScrollLatest(false);
  }

  function onMessageListScroll() {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollLatest(distanceFromBottom > 96);
  }

  const firstName = (user?.fullName ?? '').trim().split(/\s+/)[0] || null;
  const greetingHint =
    user?.role === 'CONSULTANT'
      ? 'I can see your assigned students, reviews, and handovers.'
      : user?.role === 'GUARDIAN'
        ? 'I can see your linked student’s documents, deadlines, and applications.'
        : 'I can see your documents, deadlines and applications.';

  const deskLabel = studentId ? 'Student file desk' : 'Admissions desk';
  const portalTarget =
    typeof document !== 'undefined'
      ? document.getElementById('scholara-phone-shell') ?? document.body
      : null;

  const chatPanel = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="scholara-assistant-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Scholara Assistant"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-[80] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden rounded-none border-0 bg-[#F7F6F3] sm:h-full sm:max-h-none"
        >
          <ChatHeader
            status={
              messagesQuery.isError || sendMutation.isError
                ? 'unavailable'
                : sendMutation.isPending
                  ? 'thinking'
                  : 'online'
            }
            deskLabel={deskLabel}
            canClear={messages.length > 0}
            clearPending={clearMutation.isPending}
            onHome={() => setShowStarterHome(true)}
            onClear={() => setClearConfirmOpen(true)}
            onClose={closeChat}
          />

            <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={scrollAreaRef}
              onScroll={onMessageListScroll}
              className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[var(--chat-scroll-pad-bottom)]"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Assistant conversation"
            >
              {messagesQuery.isLoading ? (
                <div className="space-y-3 px-3.5 py-4" aria-busy="true">
                  <div className="h-16 animate-pulse rounded-2xl bg-[#EBE8E0]/80" />
                  <div className="ml-auto h-12 w-[70%] animate-pulse rounded-2xl bg-[#E8E2D6]/90" />
                  <div className="h-20 w-[85%] animate-pulse rounded-2xl bg-[#EBE8E0]/80" />
                </div>
              ) : null}
              {messagesQuery.isError ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs font-semibold text-destructive">
                    Could not load chat history.
                  </p>
                  <button
                    type="button"
                    onClick={() => void messagesQuery.refetch()}
                    className="mt-2 inline-flex items-center rounded-xl border border-[#E5CE96] bg-[#FFFDF9] px-3 py-1.5 text-[11px] font-semibold text-[#0F1E36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/45"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {viewingHome &&
              !messagesQuery.isLoading &&
              !messagesQuery.isError ? (
                <div className="flex flex-col px-3.5 pb-2 pt-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F1E36] ring-1 ring-[#E5CE96]/45">
                      <CrestMark size={16} />
                    </span>
                    <div className="min-w-0 rounded-2xl rounded-bl-md border border-[#E8E2D6] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,30,54,0.03)]">
                      <h2 className="font-sans text-[13px] font-semibold leading-snug tracking-tight text-[#1E2430]">
                        {firstName
                          ? `Hi ${firstName} — how can I help today?`
                          : 'How can I help today?'}
                      </h2>
                      <p className="mt-1 text-[11.5px] leading-snug text-[#6B7280]">
                        {greetingHint}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                      Suggested
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {welcomeStarters.map(({ title, hint, prompt, icon }) => (
                        <QuickActionCard
                          key={title}
                          title={title}
                          hint={hint}
                          icon={icon}
                          disabled={sendMutation.isPending}
                          onClick={() => sendContent(prompt)}
                        />
                      ))}
                    </div>
                    {messages.length > 0 ? (
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        <TapButton
                          type="button"
                          onClick={() => setShowStarterHome(false)}
                          className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0F1E36] px-3 py-2 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-[#152844]"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Resume chat
                          <ArrowRight className="h-3 w-3" />
                        </TapButton>
                        <TapButton
                          type="button"
                          onClick={() => setClearConfirmOpen(true)}
                          disabled={clearMutation.isPending}
                          className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#E5CE96] bg-[#FFFDF9] px-3 py-2 text-[11px] font-semibold text-[#0F1E36] transition-colors duration-150 hover:bg-[#FBF3DF]"
                        >
                          <MessageSquarePlus className="h-3 w-3" />
                          New chat
                        </TapButton>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!viewingHome &&
              !messagesQuery.isLoading &&
              !messagesQuery.isError ? (
                <div className="space-y-2 px-3.5 py-3">
                  {studentId && messages.length > 0 ? (
                    <p className="rounded-lg bg-secondary/80 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground">
                      Context is this student file. Chat history for other
                      dossiers stays separate.
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
                    const prevMsg = messages[idx - 1];
                    const nextMsg = messages[idx + 1];
                    const showAvatar =
                      msg.role === 'assistant' &&
                      (!prevMsg || prevMsg.role !== 'assistant');
                    const showTimestamp =
                      !nextMsg || nextMsg.role !== msg.role;
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
                        showAvatar={showAvatar}
                        showTimestamp={showTimestamp}
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
                    <TypingIndicator />
                  ) : null}
                  {lastFailedPrompt && !sendMutation.isPending ? (
                    <div className="rounded-2xl border border-[#E8B4B4] bg-[#FFF8F8] px-3.5 py-3">
                      <p className="text-[12px] font-semibold text-[#9B1C1C]">
                        Couldn’t send that message.
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7280]">
                        Check your connection and try again.
                      </p>
                      <button
                        type="button"
                        onClick={() => sendContent(lastFailedPrompt)}
                        className="mt-2 inline-flex items-center rounded-xl bg-[#0F1E36] px-3 py-1.5 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/50"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}
                  <div ref={bottomRef} />
                </div>
              ) : null}
            </div>

            {showScrollLatest && !viewingHome ? (
              <button
                type="button"
                onClick={() => scrollToLatest()}
                className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#E5CE96] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0F1E36] shadow-[0_4px_12px_-6px_rgba(15,30,54,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/45"
              >
                Scroll to latest
              </button>
            ) : null}
            </div>

          {!viewingHome && messages.length > 0 ? (
            <SuggestionChips
              items={welcomeStarters}
              disabled={sendMutation.isPending}
              onSelect={sendContent}
            />
          ) : null}

          {viewingHome && messages.length > 0 ? (
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-2 border-t border-[#EBE8E0]/90 bg-[#F7F6F3] px-3 pt-2.5',
                'pb-[max(0.65rem,env(safe-area-inset-bottom,0px))]',
              )}
            >
              <p className="text-[11px] font-medium text-[#6B7280]">
                Menu open — resume chat to keep typing.
              </p>
              <TapButton
                type="button"
                onClick={() => setShowStarterHome(false)}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#0F1E36] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-[#152844]"
              >
                Resume
                <ArrowRight className="h-3 w-3" />
              </TapButton>
            </div>
          ) : (
            <ChatComposer
              ref={composerInputRef}
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={onSubmit}
              disabled={clearMutation.isPending}
              sending={sendMutation.isPending}
              placeholder="Ask a question about your application…"
            />
          )}

          {clearConfirmOpen ? (
            <div
              className="absolute inset-0 z-[90] flex items-end justify-center bg-[#0F1E36]/35 px-4 pb-8 pt-4 sm:items-center"
              role="presentation"
              onClick={() => setClearConfirmOpen(false)}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="clear-chat-title"
                aria-describedby="clear-chat-desc"
                className="w-full max-w-sm rounded-2xl border border-[#E8E2D6] bg-white p-4 shadow-[0_16px_40px_-16px_rgba(15,30,54,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <p
                  id="clear-chat-title"
                  className="text-[14px] font-semibold text-[#1E2430]"
                >
                  Clear this conversation?
                </p>
                <p
                  id="clear-chat-desc"
                  className="mt-1 text-[12px] leading-relaxed text-[#6B7280]"
                >
                  This removes the current chat history from this device thread.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClearConfirmOpen(false)}
                    className="flex h-10 items-center justify-center rounded-xl border border-[#E8E2D6] bg-[#FFFDF9] text-[12px] font-semibold text-[#0F1E36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/45"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={clearMutation.isPending}
                    onClick={() => {
                      setClearConfirmOpen(false);
                      startNewChat();
                    }}
                    className="flex h-10 items-center justify-center rounded-xl bg-[#0F1E36] text-[12px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/50 disabled:opacity-50"
                  >
                    {clearMutation.isPending ? 'Clearing…' : 'Clear'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      {portalTarget ? createPortal(chatPanel, portalTarget) : chatPanel}

      {!open ? (
        <motion.button
          ref={launcherRef}
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
  showAvatar = true,
  showTimestamp = true,
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
  showAvatar?: boolean;
  showTimestamp?: boolean;
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

  const timeLabel = showTimestamp ? formatChatTime(message.createdAt) : '';
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion
    ? undefined
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.16 } };

  if (isUser) {
    return (
      <motion.div
        {...enter}
        className="ml-auto flex max-w-[88%] flex-col items-end gap-1"
      >
        <div className="rounded-2xl rounded-br-md bg-[#0F1E36] px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-[0_2px_8px_rgba(15,30,54,0.12)]">
          <p className="whitespace-pre-wrap font-medium">{message.content}</p>
        </div>
        {timeLabel ? (
          <p className="px-1 text-[10px] font-medium text-[#6B7280]">{timeLabel}</p>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div {...enter} className="flex w-full items-end gap-2">
      {showAvatar ? (
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F1E36] ring-1 ring-[#E5CE96]/40',
            showTimestamp ? 'mb-5' : 'mb-0.5',
          )}
        >
          <CrestMark size={16} />
        </span>
      ) : (
        <span className="w-7 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-bl-md border border-[#E8E2D6] bg-white px-3.5 py-3 text-[13px] leading-relaxed text-[#1E2430] shadow-[0_1px_2px_rgba(15,30,54,0.04)]">
          {renderAssistantContent(message.content)}
        </div>
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
        {timeLabel ? (
          <p className="px-1 text-[10px] font-medium text-[#6B7280]">{timeLabel}</p>
        ) : null}
      </div>
    </motion.div>
  );
}

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
