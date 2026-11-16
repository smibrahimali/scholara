import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  MessageCircle,
  MessageSquare,
  Mic,
  Phone,
  PhoneOff,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '../components/ivy/EmptyState';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { getBackPath, withFrom } from '../lib/navigation';
import {
  sameTimeConflictMessage,
  type OccupiedScheduleSlot,
} from '../lib/scheduleConflicts';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  approveCallRequest,
  cancelCallRequest,
  createCallRequest,
  endCall,
  fetchCall,
  fetchCallRequests,
  fetchCalls,
  fetchDashboard,
  rejectCallRequest,
  startCall,
} from '../services/scholaraApi';
import {
  approveChatRequest,
  cancelChatRequest,
  createChatRequest,
  endChatSession,
  fetchChatRequests,
  fetchOpenChatSession,
  rejectChatRequest,
  startChatSession,
} from '../services/messagingApi';
import type {
  CallRequestItem,
  CallSessionItem,
  ChatRequestItem,
} from '../types/domain';

type SessionKind = 'CALL' | 'CHAT';

type HistoryEntry =
  | {
      key: string;
      kind: 'CALL';
      at: string;
      title: string;
      subtitle: string;
      status: string;
      note?: string | null;
      call?: CallSessionItem;
    }
  | {
      key: string;
      kind: 'CHAT';
      at: string;
      title: string;
      subtitle: string;
      status: string;
      note?: string | null;
    };

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string | string[] } } })?.response
      ?.data?.message ?? fallback
  );
}

function formatSchedule(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatOpenAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'scheduled time';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isAtOrAfterSchedule(iso: string) {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() >= t;
}

const JOIN_ROOM_BTN =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-50';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const BOOKING_WINDOW_DAYS = 10;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, days: number) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function buildMonthCells(viewMonth: Date): (Date | null)[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function parseTimeValue(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

function combineSchedule(date: Date, time: string) {
  const parsed = parseTimeValue(time);
  if (!parsed) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    parsed.hours,
    parsed.minutes,
    0,
    0,
  );
}

function isTimePastOnDate(date: Date, time: string) {
  const when = combineSchedule(date, time);
  return when !== null && when.getTime() < Date.now();
}

function statusClass(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'LIVE':
      return 'bg-success/15 text-success';
    case 'COMPLETED':
      return 'bg-secondary text-foreground';
    case 'REJECTED':
      return 'bg-destructive-soft text-destructive';
    case 'CANCELLED':
      return 'bg-secondary text-muted-foreground';
    default:
      return 'bg-gold-soft text-gold-ink';
  }
}

function invalidateSessionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
  void queryClient.invalidateQueries({ queryKey: ['chat-requests'] });
  void queryClient.invalidateQueries({ queryKey: ['calls'] });
  void queryClient.invalidateQueries({ queryKey: ['chat-session-open'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  void queryClient.invalidateQueries({ queryKey: ['consultant-students'] });
  void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
}

function HistoryCallCard({ call }: { call: CallSessionItem }) {
  const [open, setOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ['call', call.id],
    queryFn: () => fetchCall(call.id),
    enabled: open,
    staleTime: 60_000,
  });
  const detail = detailQuery.data ?? call;
  const consultantName = call.consultant?.user?.fullName ?? 'Consultant';

  return (
    <article className="ivy-card">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ivy-medallion flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps">Completed call</p>
          <p className="font-sans text-lg font-semibold text-foreground">
            with {consultantName}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDisplayDate(call.startedAt)}
            {call.endedAt ? ` → ${formatDisplayDate(call.endedAt)}` : ''}
          </p>
          {call.note?.summary ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {call.note.summary}
            </p>
          ) : null}
        </div>
        {open ? (
          <ChevronUp className="mt-1 h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <p className="label-caps mb-1">Transcript</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {detailQuery.isLoading
                ? 'Loading transcript…'
                : detail.transcript?.trim() || 'No transcript saved yet.'}
            </p>
          </div>
          {detail.note ? (
            <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <p className="label-caps">Call note</p>
              <p className="text-sm">
                <span className="font-semibold">Summary: </span>
                {detail.note.summary}
              </p>
              <p className="text-sm whitespace-pre-wrap">
                <span className="font-semibold">Actions: </span>
                {detail.note.actionItems}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Universities: </span>
                {detail.note.universitiesDiscussed}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Follow-ups: </span>
                {detail.note.followUps}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No structured note yet.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function BookSessionCard({
  kind,
  onKindChange,
  callBlocked,
  chatBlocked,
  occupiedSlots,
  readOnly,
}: {
  kind: SessionKind;
  onKindChange: (kind: SessionKind) => void;
  callBlocked: boolean;
  chatBlocked: boolean;
  occupiedSlots: OccupiedScheduleSlot[];
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(
    () => addDays(today, BOOKING_WINDOW_DAYS),
    [today],
  );
  const [viewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [selectedTime, setSelectedTime] = useState('');
  const [note, setNote] = useState('');

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);

  const timeIsPast =
    selectedDate !== null &&
    selectedTime !== '' &&
    isTimePastOnDate(selectedDate, selectedTime);

  const scheduledIso = useMemo(() => {
    if (!selectedDate || !selectedTime || timeIsPast) return null;
    const when = combineSchedule(selectedDate, selectedTime);
    return when ? when.toISOString() : null;
  }, [selectedDate, selectedTime, timeIsPast]);

  const sameTimeConflict = useMemo(
    () =>
      scheduledIso
        ? sameTimeConflictMessage(scheduledIso, occupiedSlots)
        : null,
    [scheduledIso, occupiedSlots],
  );

  const createCallMutation = useMutation({
    mutationFn: () => {
      if (!scheduledIso) throw new Error('Pick a date and time');
      const conflict = sameTimeConflictMessage(scheduledIso, occupiedSlots);
      if (conflict) throw new Error(conflict);
      return createCallRequest(scheduledIso, note.trim() || undefined);
    },
    onSuccess: () => {
      toast.success('Call request sent to your consultant');
      setNote('');
      setSelectedTime('');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not schedule call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const createChatMutation = useMutation({
    mutationFn: () => {
      if (!scheduledIso) throw new Error('Pick a date and time');
      const conflict = sameTimeConflictMessage(scheduledIso, occupiedSlots);
      if (conflict) throw new Error(conflict);
      return createChatRequest(scheduledIso, note.trim() || undefined);
    },
    onSuccess: () => {
      toast.success('Chat request sent to your consultant');
      setNote('');
      setSelectedTime('');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not schedule chat');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const pending =
    kind === 'CALL'
      ? createCallMutation.isPending
      : createChatMutation.isPending;
  const blocked = kind === 'CALL' ? callBlocked : chatBlocked;
  const canSubmit =
    Boolean(scheduledIso) && !pending && !sameTimeConflict;

  if (readOnly) {
    return (
      <div className="ivy-card mb-8">
        <p className="label-caps mb-2">Book a Session</p>
        <EmptyState
          icon={CalendarDays}
          title="Booking unavailable"
          description="Guardians can view upcoming sessions but cannot book new ones."
          className="p-6"
        />
      </div>
    );
  }

  return (
    <div className="ivy-card mb-8 space-y-5">
      <div>
        <p className="label-caps">Book a Session</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Request a private 1:1 with your consultant. They approve the time,
          then open the room when ready.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#EBE8E0] bg-[#F3F2F0] p-1 shadow-well">
        <button
          type="button"
          onClick={() => onKindChange('CALL')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition',
            kind === 'CALL'
              ? 'btn-chip-active font-semibold'
              : 'font-medium text-[#525B6B] hover:text-[#0F1E36]',
          )}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          1:1 Audio Call
        </button>
        <button
          type="button"
          onClick={() => onKindChange('CHAT')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition',
            kind === 'CHAT'
              ? 'btn-chip-active font-semibold'
              : 'font-medium text-[#525B6B] hover:text-[#0F1E36]',
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          1:1 Live Chat
        </button>
      </div>

      {blocked ? (
        <EmptyState
          icon={kind === 'CALL' ? Phone : MessageSquare}
          title={
            kind === 'CALL'
              ? 'You already have a call scheduled.'
              : 'You already have a chat scheduled.'
          }
          description="Manage it under Upcoming Sessions, or cancel to book a new time."
          className="p-6"
        />
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            if (kind === 'CALL') createCallMutation.mutate();
            else createChatMutation.mutate();
          }}
        >
          <div className="rounded-xl border border-[#EBE8E0] bg-[#F3F2F0] p-3 shadow-well">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#1E2430]">
                {monthLabel(viewMonth)}
              </p>
              <span className="rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400E]">
                Next 10 days
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d) => (
                <span
                  key={d}
                  className="flex h-6 items-center justify-center text-[10px] font-semibold tracking-wide text-[#8B92A5]"
                >
                  {d}
                </span>
              ))}
              {cells.map((cell, idx) => {
                if (!cell) {
                  return <span key={`e-${idx}`} className="h-9 w-full" />;
                }
                const day = startOfDay(cell);
                const locked =
                  day.getTime() < today.getTime() ||
                  day.getTime() > maxDate.getTime();
                const selected =
                  selectedDate !== null && sameDay(cell, selectedDate);
                return (
                  <button
                    key={cell.toISOString()}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setSelectedDate(cell);
                      setSelectedTime('');
                    }}
                    className={cn(
                      'flex h-9 w-full items-center justify-center rounded-lg text-sm transition-all',
                      locked &&
                        'pointer-events-none text-slate-400 opacity-50',
                      !locked &&
                        !selected &&
                        'border border-[#EBE8E0] bg-white text-[#1E2430] hover:shadow-sm',
                      selected &&
                        'bg-[#111827] font-semibold text-white shadow-md',
                    )}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-[#8B92A5]">
              Time
            </span>
            <input
              type="time"
              value={selectedTime}
              disabled={!selectedDate}
              onChange={(e) => setSelectedTime(e.target.value)}
              className={cn(
                'h-11 w-full rounded-xl border px-3 text-sm outline-none transition-all',
                !selectedDate &&
                  'cursor-not-allowed border-dashed border-slate-300 bg-transparent text-slate-400',
                selectedDate &&
                  !timeIsPast &&
                  'border-[#EBE8E0] bg-white text-[#1E2430] shadow-sm focus:border-[#C8963E] focus:shadow-md',
                selectedDate &&
                  timeIsPast &&
                  'border-dashed border-slate-300 bg-[#F3F2F0] text-slate-400',
              )}
            />
            {timeIsPast ? (
              <p className="mt-1.5 text-xs text-slate-500">
                Pick a future time for today.
              </p>
            ) : null}
            {sameTimeConflict ? (
              <p className="mt-1.5 text-xs text-destructive">{sameTimeConflict}</p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-[#8B92A5]">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={
                kind === 'CALL'
                  ? 'What would you like to discuss?'
                  : 'What would you like to chat about?'
              }
              className="w-full resize-none rounded-xl border border-[#EBE8E0] bg-[#F3F2F0] px-3 py-2.5 text-sm text-[#1E2430] shadow-well outline-none focus:border-[#C8963E] focus:bg-white"
            />
          </label>

          <TapButton
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200',
              canSubmit
                ? 'btn-primary'
                : 'cursor-not-allowed border border-[#EBE8E0] bg-[#F3F2F0] text-[#9CA3AF] shadow-none',
            )}
          >
            <Check className="h-4 w-4" strokeWidth={1.5} />
            {pending
              ? 'Sending…'
              : !selectedDate || !selectedTime
                ? 'Select a date & time'
                : timeIsPast
                  ? 'Pick a future time'
                  : sameTimeConflict
                    ? 'Pick another time'
                    : kind === 'CALL'
                      ? 'Request 1:1 Call'
                      : 'Request 1:1 Chat'}
          </TapButton>
        </form>
      )}
    </div>
  );
}

export function MyConsultantPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ studentId?: string }>();
  const queryClient = useQueryClient();
  const resolvedStudentId = studentId ?? params.studentId;
  const isConsultant = user?.role === 'CONSULTANT';
  const isGuardian = user?.role === 'GUARDIAN';
  const backFallback =
    isConsultant && resolvedStudentId
      ? `/app/students/${resolvedStudentId}`
      : '/app';
  const backTo = getBackPath(location, backFallback);
  const focus = (location.state as { focus?: string } | null)?.focus;
  const bookSectionRef = useRef<HTMLDivElement>(null);

  const [bookKind, setBookKind] = useState<SessionKind>(
    focus === 'chat' ? 'CHAT' : 'CALL',
  );
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  useEffect(() => {
    if (focus === 'chat') setBookKind('CHAT');
    if (focus === 'call') setBookKind('CALL');
    if (focus !== 'chat' && focus !== 'call') return;
    const id = window.setTimeout(() => {
      bookSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [focus]);

  const sessionScopeEnabled =
    Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', resolvedStudentId ?? 'self'],
    queryFn: () => fetchDashboard(resolvedStudentId),
    enabled: sessionScopeEnabled,
    staleTime: 60_000,
  });

  const callsQuery = useQuery({
    queryKey: ['calls', resolvedStudentId ?? 'self'],
    queryFn: () => fetchCalls(resolvedStudentId),
    enabled: sessionScopeEnabled,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const hasOpen = query.state.data?.some((call) => !call.endedAt);
      return hasOpen ? 4000 : 30_000;
    },
  });

  const callRequestsQuery = useQuery({
    queryKey: ['call-requests', resolvedStudentId ?? 'self'],
    queryFn: () =>
      fetchCallRequests(
        resolvedStudentId ? { studentId: resolvedStudentId } : undefined,
      ),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const active = query.state.data?.some(
        (r) => r.status === 'PENDING' || r.status === 'APPROVED',
      );
      return active ? 5000 : 30_000;
    },
    enabled: sessionScopeEnabled,
  });

  const chatRequestsQuery = useQuery({
    queryKey: ['chat-requests', resolvedStudentId ?? 'self'],
    queryFn: () =>
      fetchChatRequests(
        resolvedStudentId ? { studentId: resolvedStudentId } : undefined,
      ),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const active = query.state.data?.some(
        (r) => r.status === 'PENDING' || r.status === 'APPROVED',
      );
      return active ? 5000 : 30_000;
    },
    enabled: sessionScopeEnabled,
  });

  const openChatQuery = useQuery({
    queryKey: ['chat-session-open', resolvedStudentId ?? 'self'],
    queryFn: () => fetchOpenChatSession(resolvedStudentId),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      return query.state.data ? 4000 : 30_000;
    },
    enabled: sessionScopeEnabled,
  });

  const cancelCallMutation = useMutation({
    mutationFn: (id: string) => cancelCallRequest(id),
    onSuccess: () => {
      toast.success('Request cancelled');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not cancel');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const cancelChatMutation = useMutation({
    mutationFn: (id: string) => cancelChatRequest(id),
    onSuccess: () => {
      toast.success('Request cancelled');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not cancel');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const approveCallMutation = useMutation({
    mutationFn: (id: string) => approveCallRequest(id),
    onSuccess: () => {
      toast.success('Request approved');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not approve');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const approveChatMutation = useMutation({
    mutationFn: (id: string) => approveChatRequest(id),
    onSuccess: () => {
      toast.success('Chat request approved');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not approve');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const rejectCallMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectCallRequest(id, reason),
    onSuccess: () => {
      toast.success('Request rejected');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not reject');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const rejectChatMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectChatRequest(id, reason),
    onSuccess: () => {
      toast.success('Request rejected');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not reject');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const startCallMutation = useMutation({
    mutationFn: (callRequestId: string) => startCall(callRequestId),
    onSuccess: (call) => {
      toast.success('Live call started — allow microphone access');
      invalidateSessionQueries(queryClient);
      navigate(`/app/live-call/${call.id}`, withFrom(location.pathname));
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not start call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const messagesPath =
    isConsultant && resolvedStudentId
      ? `/app/students/${resolvedStudentId}/messages`
      : '/app/messages';

  const startChatMutation = useMutation({
    mutationFn: (chatRequestId: string) => startChatSession(chatRequestId),
    onSuccess: () => {
      toast.success('Encrypted chat started');
      invalidateSessionQueries(queryClient);
      navigate(messagesPath, withFrom(location.pathname));
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not start chat');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const endCallMutation = useMutation({
    mutationFn: (callId: string) => endCall(callId),
    onSuccess: () => {
      toast.success('Open call ended');
      invalidateSessionQueries(queryClient);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not end call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const endChatMutation = useMutation({
    mutationFn: (sessionId: string) => endChatSession(sessionId),
    onSuccess: () => {
      toast.success('Chat ended — messages cleared');
      invalidateSessionQueries(queryClient);
      void queryClient.removeQueries({ queryKey: ['messaging-messages'] });
      void queryClient.removeQueries({ queryKey: ['messaging-conversation'] });
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not end chat');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const callRequests = callRequestsQuery.data ?? [];
  const chatRequests = chatRequestsQuery.data ?? [];
  const calls = callsQuery.data ?? [];

  const historyEntries = useMemo((): HistoryEntry[] => {
    const callReqs = callRequestsQuery.data ?? [];
    const chatReqs = chatRequestsQuery.data ?? [];
    const callSessions = callsQuery.data ?? [];
    const pastCalls = callReqs.filter(
      (r) => r.status !== 'PENDING' && r.status !== 'APPROVED',
    );
    const pastChats = chatReqs.filter(
      (r) => r.status !== 'PENDING' && r.status !== 'APPROVED',
    );
    const endedCalls = callSessions.filter((c) => Boolean(c.endedAt));
    const linkedSessionIds = new Set(
      pastCalls
        .map((r) => r.callSessionId)
        .filter((id): id is string => Boolean(id)),
    );

    const entries: HistoryEntry[] = [
      ...pastCalls.map((r) => {
        const linked = r.callSessionId
          ? endedCalls.find((c) => c.id === r.callSessionId)
          : undefined;
        return {
          key: `call-req-${r.id}`,
          kind: 'CALL' as const,
          at: r.scheduledFor || r.updatedAt,
          title: formatSchedule(r.scheduledFor),
          subtitle: isConsultant
            ? r.studentName ?? 'Student'
            : r.consultantName ?? 'Consultant',
          status: r.status,
          note: r.studentNote ?? r.consultantNote ?? linked?.note?.summary,
          call: linked,
        };
      }),
      ...pastChats.map((r) => ({
        key: `chat-req-${r.id}`,
        kind: 'CHAT' as const,
        at: r.scheduledFor || r.updatedAt,
        title: formatSchedule(r.scheduledFor),
        subtitle: isConsultant
          ? r.studentName ?? 'Student'
          : r.consultantName ?? 'Consultant',
        status: r.status,
        note: r.studentNote ?? r.consultantNote,
      })),
      ...endedCalls
        .filter((c) => !linkedSessionIds.has(c.id))
        .map((c) => ({
          key: `call-session-${c.id}`,
          kind: 'CALL' as const,
          at: c.endedAt ?? c.startedAt,
          title: `Call · ${formatDisplayDate(c.startedAt)}`,
          subtitle: c.consultant?.user?.fullName ?? 'Consultant',
          status: 'COMPLETED',
          note: c.note?.summary ?? null,
          call: c,
        })),
    ];

    return entries.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [
    callRequestsQuery.data,
    chatRequestsQuery.data,
    callsQuery.data,
    isConsultant,
  ]);

  if (isConsultant && !resolvedStudentId) {
    return (
      <PageMotion>
        <ScreenTitle eyebrow="Calls" title="Pick a student" />
        <p className="text-sm text-muted-foreground">
          Open a student dossier, then use Calls — or go back to your assigned
          list.
        </p>
        <TapButton
          className="btn-primary mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
          onClick={() => navigate('/app')}
        >
          Back to students
        </TapButton>
      </PageMotion>
    );
  }

  if (dashboardQuery.isLoading || callsQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading consultant & calls…</p>
    );
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <p className="text-sm text-destructive">Could not load consultant details.</p>
    );
  }

  const consultant = dashboardQuery.data.student.consultant;
  const openCall = calls.find((c) => !c.endedAt) ?? null;
  const openChatSession = openChatQuery.data ?? null;
  const canEnterEncryptedChat = Boolean(openChatSession);
  const activeCalls = callRequests.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const activeChats = chatRequests.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const hasUpcoming =
    activeCalls.length > 0 ||
    activeChats.length > 0 ||
    Boolean(openCall) ||
    Boolean(openChatSession);

  function renderCallUpcoming(request: CallRequestItem) {
    const isLive =
      Boolean(openCall) &&
      (!request.callSessionId || openCall?.id === request.callSessionId);
    const badge = isLive ? 'LIVE' : request.status;
    const accent = isLive || request.status === 'APPROVED' ? '#C8963E' : '#8A570E';

    return (
      <article
        key={`call-${request.id}`}
        className="ivy-card border-l-4 !rounded-xl"
        style={{ borderLeftColor: accent }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-[#8A570E]" />
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8A570E]">
                1:1 Audio Call
              </p>
            </div>
            <p className="font-sans text-base font-semibold text-foreground">
              {formatSchedule(request.scheduledFor)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isConsultant
                ? request.studentName ?? 'Student'
                : request.consultantName ?? 'Consultant'}
            </p>
            {request.studentNote ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {request.studentNote}
              </p>
            ) : null}
            {request.consultantNote ? (
              <p className="mt-1 text-sm text-destructive">
                Consultant: {request.consultantNote}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]',
              statusClass(badge),
            )}
          >
            {badge}
          </span>
        </div>

        {!isGuardian && !isConsultant && request.status === 'PENDING' ? (
          <TapButton
            className="btn-outline mt-3 flex w-full items-center justify-center rounded-xl text-sm font-semibold"
            disabled={cancelCallMutation.isPending}
            onClick={() => cancelCallMutation.mutate(request.id)}
          >
            Cancel request
          </TapButton>
        ) : null}

        {isConsultant && request.status === 'PENDING' ? (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <TapButton
                className="btn-primary flex flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
                disabled={approveCallMutation.isPending}
                onClick={() => approveCallMutation.mutate(request.id)}
              >
                <Check className="h-4 w-4" /> Approve
              </TapButton>
              <TapButton
                className="btn-outline flex flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
                disabled={rejectCallMutation.isPending}
                onClick={() =>
                  rejectCallMutation.mutate({
                    id: request.id,
                    reason: rejectReason[request.id],
                  })
                }
              >
                <X className="h-4 w-4" /> Reject
              </TapButton>
            </div>
            <input
              value={rejectReason[request.id] ?? ''}
              onChange={(e) =>
                setRejectReason((prev) => ({
                  ...prev,
                  [request.id]: e.target.value,
                }))
              }
              placeholder="Optional rejection note"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none"
            />
          </div>
        ) : null}

        {isConsultant && request.status === 'APPROVED' ? (
          isLive && openCall ? (
            <div className="mt-3 flex gap-2">
              <TapButton
                className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                onClick={() =>
                  navigate(
                    `/app/live-call/${openCall.id}`,
                    withFrom(location.pathname),
                  )
                }
              >
                <Mic className="h-4 w-4" /> Rejoin
              </TapButton>
              <TapButton
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
                disabled={endCallMutation.isPending}
                onClick={() => endCallMutation.mutate(openCall.id)}
              >
                <PhoneOff className="h-4 w-4" />
                {endCallMutation.isPending ? 'Ending…' : 'End call'}
              </TapButton>
            </div>
          ) : (
            <TapButton
              className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              disabled={startCallMutation.isPending}
              onClick={() => startCallMutation.mutate(request.id)}
            >
              <Phone className="h-4 w-4" />
              {startCallMutation.isPending ? 'Starting…' : 'Start live call'}
            </TapButton>
          )
        ) : null}

        {!isConsultant && request.status === 'APPROVED' ? (
          <div className="mt-3">
            <TapButton
              type="button"
              disabled={!isLive || !isAtOrAfterSchedule(request.scheduledFor)}
              onClick={() => {
                if (openCall) {
                  navigate(
                    `/app/live-call/${openCall.id}`,
                    withFrom(location.pathname),
                  );
                }
              }}
              className={JOIN_ROOM_BTN}
            >
              <Mic className="h-4 w-4" />
              {!isAtOrAfterSchedule(request.scheduledFor)
                ? `Opens at ${formatOpenAt(request.scheduledFor)}`
                : isLive
                  ? 'Join Room'
                  : 'Waiting for consultant to start call'}
            </TapButton>
          </div>
        ) : null}
      </article>
    );
  }

  function renderChatUpcoming(request: ChatRequestItem) {
    const isLive =
      Boolean(openChatSession) &&
      (!request.chatSessionId ||
        openChatSession?.id === request.chatSessionId);
    const badge = isLive ? 'LIVE' : request.status;
    const accent =
      isLive || request.status === 'APPROVED' ? '#17593E' : '#8A570E';

    return (
      <article
        key={`chat-${request.id}`}
        className="ivy-card border-l-4 !rounded-xl"
        style={{ borderLeftColor: accent }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-[#17593E]" />
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#17593E]">
                1:1 Live Chat
              </p>
            </div>
            <p className="font-sans text-base font-semibold text-foreground">
              {formatSchedule(request.scheduledFor)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isConsultant
                ? request.studentName ?? 'Student'
                : request.consultantName ?? 'Consultant'}
            </p>
            {request.studentNote ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {request.studentNote}
              </p>
            ) : null}
            {request.consultantNote ? (
              <p className="mt-1 text-sm text-destructive">
                Consultant: {request.consultantNote}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]',
              statusClass(badge),
            )}
          >
            {badge}
          </span>
        </div>

        {!isGuardian && !isConsultant && request.status === 'PENDING' ? (
          <TapButton
            className="btn-outline mt-3 flex w-full items-center justify-center rounded-xl text-sm font-semibold"
            disabled={cancelChatMutation.isPending}
            onClick={() => cancelChatMutation.mutate(request.id)}
          >
            Cancel request
          </TapButton>
        ) : null}

        {isConsultant && request.status === 'PENDING' ? (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <TapButton
                className="btn-primary flex flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
                disabled={approveChatMutation.isPending}
                onClick={() => approveChatMutation.mutate(request.id)}
              >
                <Check className="h-4 w-4" /> Approve
              </TapButton>
              <TapButton
                className="btn-outline flex flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
                disabled={rejectChatMutation.isPending}
                onClick={() =>
                  rejectChatMutation.mutate({
                    id: request.id,
                    reason: rejectReason[request.id],
                  })
                }
              >
                <X className="h-4 w-4" /> Reject
              </TapButton>
            </div>
            <input
              value={rejectReason[request.id] ?? ''}
              onChange={(e) =>
                setRejectReason((prev) => ({
                  ...prev,
                  [request.id]: e.target.value,
                }))
              }
              placeholder="Optional rejection note"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none"
            />
          </div>
        ) : null}

        {isConsultant && request.status === 'APPROVED' ? (
          isLive && openChatSession ? (
            <div className="mt-3 flex gap-2">
              <TapButton
                className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                onClick={() =>
                  navigate(messagesPath, withFrom(location.pathname))
                }
              >
                <MessageCircle className="h-4 w-4" /> Open chat
              </TapButton>
              <TapButton
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
                disabled={endChatMutation.isPending}
                onClick={() => endChatMutation.mutate(openChatSession.id)}
              >
                {endChatMutation.isPending ? 'Ending…' : 'End'}
              </TapButton>
            </div>
          ) : (
            <TapButton
              className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
              disabled={startChatMutation.isPending}
              onClick={() => startChatMutation.mutate(request.id)}
            >
              <MessageCircle className="h-4 w-4" />
              {startChatMutation.isPending
                ? 'Starting…'
                : 'Start encrypted chat'}
            </TapButton>
          )
        ) : null}

        {!isConsultant && request.status === 'APPROVED' ? (
          <div className="mt-3">
            <TapButton
              type="button"
              disabled={!isLive || !isAtOrAfterSchedule(request.scheduledFor)}
              onClick={() =>
                navigate(messagesPath, withFrom(location.pathname))
              }
              className={JOIN_ROOM_BTN}
            >
              <MessageCircle className="h-4 w-4" />
              {!isAtOrAfterSchedule(request.scheduledFor)
                ? `Opens at ${formatOpenAt(request.scheduledFor)}`
                : isLive
                  ? 'Join Room'
                  : 'Waiting for consultant to open room'}
            </TapButton>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <PageMotion className="pb-36">
      <div className="mb-3 flex items-center gap-2">
        <TapButton
          aria-label="Back"
          className="btn-outline flex h-10 w-10 items-center justify-center rounded-full"
          onClick={() => navigate(backTo)}
        >
          <ArrowLeft className="h-4 w-4" />
        </TapButton>
        <ScreenTitle
          eyebrow={isConsultant ? 'Student calls' : 'Support'}
          title={isConsultant ? 'Schedule & calls' : 'My Consultant'}
        />
      </div>

      {consultant ? (
        <div className="ivy-card mb-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#EBE8E0] bg-[#111827] font-sans text-xl text-primary-foreground">
              {consultant.fullName[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-xl font-semibold text-[#1E2430]">
                {consultant.fullName}
              </p>
              <p className="text-sm font-normal text-[#8B92A5]">
                {consultant.title ?? 'Admissions Consultant'}
              </p>
              {!isConsultant ? (
                <p className="mt-1 text-xs font-normal text-[#8B92A5]">
                  Book a session below. Encrypted rooms open after your
                  consultant starts them.
                </p>
              ) : null}
            </div>
            <UserRound className="h-5 w-5 text-[#8B92A5]" strokeWidth={1.5} />
          </div>
          {canEnterEncryptedChat ? (
            <TapButton
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#162B4D] to-[#0D1A30] py-3 text-sm font-semibold text-white shadow-sm"
              onClick={() =>
                navigate(messagesPath, withFrom(location.pathname))
              }
            >
              <MessageCircle className="h-4 w-4 text-white" />
              {isGuardian ? 'View chat' : 'Encrypted chat'}
            </TapButton>
          ) : null}
        </div>
      ) : (
        <div className="ivy-card mb-8">
          <EmptyState
            icon={UserRound}
            title="No consultant assigned"
            description="Ask your school admin to assign an admissions consultant."
          />
        </div>
      )}

      <section className="mb-8 space-y-5">
        <h2 className="font-sans text-lg font-semibold text-[#1E2430]">
          Upcoming Sessions
        </h2>

        {!hasUpcoming ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming sessions scheduled"
            description="Book a call or chat below when you are ready to meet."
          />
        ) : (
          <div className="space-y-4">
            {activeCalls.map(renderCallUpcoming)}
            {openCall &&
            !activeCalls.some(
              (r) =>
                r.status === 'APPROVED' &&
                (!r.callSessionId || r.callSessionId === openCall.id),
            ) ? (
              <article className="ivy-card border-l-4 border-l-[#C8963E] !rounded-xl">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Phone
                        className="h-3.5 w-3.5 text-[#8A570E]"
                        strokeWidth={1.5}
                      />
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8B92A5]">
                        1:1 Audio Call
                      </p>
                    </div>
                    <p className="font-sans text-base font-semibold text-[#1E2430]">
                      Session in progress
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]',
                      statusClass('LIVE'),
                    )}
                  >
                    LIVE
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <TapButton
                    className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                    onClick={() =>
                      navigate(
                        `/app/live-call/${openCall.id}`,
                        withFrom(location.pathname),
                      )
                    }
                  >
                    <Mic className="h-4 w-4" />
                    {isConsultant ? 'Rejoin' : 'Join Room'}
                  </TapButton>
                  {isConsultant ? (
                    <TapButton
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
                      disabled={endCallMutation.isPending}
                      onClick={() => endCallMutation.mutate(openCall.id)}
                    >
                      <PhoneOff className="h-4 w-4" />
                      {endCallMutation.isPending ? 'Ending…' : 'End call'}
                    </TapButton>
                  ) : null}
                </div>
              </article>
            ) : null}

            {activeChats.map(renderChatUpcoming)}
            {openChatSession &&
            !activeChats.some(
              (r) =>
                r.status === 'APPROVED' &&
                (!r.chatSessionId ||
                  r.chatSessionId === openChatSession.id),
            ) ? (
              <article className="ivy-card border-l-4 border-l-[#065F46] !rounded-xl">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <MessageSquare
                        className="h-3.5 w-3.5 text-[#065F46]"
                        strokeWidth={1.5}
                      />
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8B92A5]">
                        1:1 Live Chat
                      </p>
                    </div>
                    <p className="font-sans text-base font-semibold text-[#1E2430]">
                      Room is open
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]',
                      statusClass('LIVE'),
                    )}
                  >
                    LIVE
                  </span>
                </div>
                <TapButton
                  className={cn(JOIN_ROOM_BTN, 'mt-3')}
                  onClick={() =>
                    navigate(messagesPath, withFrom(location.pathname))
                  }
                >
                  <MessageCircle className="h-4 w-4" /> Join Room
                </TapButton>
              </article>
            ) : null}
          </div>
        )}
      </section>

      {!isConsultant ? (
        <div ref={bookSectionRef}>
          <BookSessionCard
            kind={bookKind}
            onKindChange={setBookKind}
            callBlocked={activeCalls.length > 0}
            chatBlocked={activeChats.length > 0}
            occupiedSlots={[
              ...activeCalls.map(
                (r): OccupiedScheduleSlot => ({
                  kind: 'CALL',
                  scheduledFor: r.scheduledFor,
                }),
              ),
              ...activeChats.map(
                (r): OccupiedScheduleSlot => ({
                  kind: 'CHAT',
                  scheduledFor: r.scheduledFor,
                }),
              ),
            ]}
            readOnly={isGuardian}
          />
        </div>
      ) : null}

      <section className="mb-8 space-y-5">
        <h2 className="font-sans text-lg font-semibold text-[#1E2430]">
          Session History
        </h2>
        {historyEntries.length === 0 ? (
          <EmptyState
            icon={History}
            title="No past sessions yet"
            description="Completed calls and chats will appear here."
          />
        ) : (
          <div className="space-y-4">
            {historyEntries.map((entry) =>
              entry.kind === 'CALL' && entry.call ? (
                <HistoryCallCard key={entry.key} call={entry.call} />
              ) : (
                <article key={entry.key} className="ivy-card">
                  <div className="flex items-start gap-3">
                    <span className="ivy-medallion flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                      {entry.kind === 'CALL' ? (
                        <Phone className="h-5 w-5" />
                      ) : (
                        <MessageSquare className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="label-caps">
                            {entry.kind === 'CALL' ? 'Audio call' : 'Live chat'}
                          </p>
                          <p className="font-sans text-base font-semibold text-foreground">
                            {entry.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.subtitle}
                          </p>
                          {entry.note ? (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                              {entry.note}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]',
                            statusClass(entry.status),
                          )}
                        >
                          {entry.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      {!isConsultant ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Need something else?{' '}
          <Link to={backTo} className="underline">
            {backTo === '/app/profile' ? 'Back to profile' : 'Back to home'}
          </Link>
        </p>
      ) : null}
    </PageMotion>
  );
}
