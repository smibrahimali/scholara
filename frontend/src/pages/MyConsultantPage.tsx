import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mic,
  Phone,
  PhoneOff,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatSchedulingPanel } from '../components/ChatSchedulingPanel';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import { formatDisplayDate } from '../lib/statusMaps';
import {
  approveCallRequest,
  cancelCallRequest,
  createCallRequest,
  endCall,
  fetchCallRequests,
  fetchCalls,
  fetchDashboard,
  rejectCallRequest,
  startCall,
} from '../services/scholaraApi';
import type { CallRequestItem, CallSessionItem } from '../types/domain';

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

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultScheduleValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInputValue(d);
}

function statusClass(status: CallRequestItem['status']) {
  switch (status) {
    case 'APPROVED':
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

function CallCard({ call }: { call: CallSessionItem }) {
  const [open, setOpen] = useState(false);
  const consultantName = call.consultant?.user.fullName ?? 'Consultant';
  const ended = Boolean(call.endedAt);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-gold-ink">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-caps">{ended ? 'Completed call' : 'Open call'}</p>
          <p className="font-serif text-lg font-semibold text-foreground">
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
              {call.transcript?.trim() || 'No transcript saved yet.'}
            </p>
          </div>
          {call.note ? (
            <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <p className="label-caps">Call note</p>
              <p className="text-sm">
                <span className="font-semibold">Summary: </span>
                {call.note.summary}
              </p>
              <p className="text-sm whitespace-pre-wrap">
                <span className="font-semibold">Actions: </span>
                {call.note.actionItems}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Universities: </span>
                {call.note.universitiesDiscussed}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Follow-ups: </span>
                {call.note.followUps}
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

function CallSchedulingPanel({
  studentId,
  isConsultant,
  readOnly,
}: {
  studentId?: string;
  isConsultant: boolean;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scheduledFor, setScheduledFor] = useState(defaultScheduleValue);
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const requestsQuery = useQuery({
    queryKey: ['call-requests', studentId ?? 'self'],
    queryFn: () =>
      fetchCallRequests(studentId ? { studentId } : undefined),
    refetchInterval: 5000,
  });

  const callsQuery = useQuery({
    queryKey: ['calls', studentId ?? 'self'],
    queryFn: () => fetchCalls(studentId),
    enabled: isConsultant,
    refetchInterval: 4000,
  });

  const openCall = useMemo(
    () => callsQuery.data?.find((c) => !c.endedAt) ?? null,
    [callsQuery.data],
  );

  const requests = requestsQuery.data ?? [];
  const active = requests.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const history = requests.filter(
    (r) => r.status !== 'PENDING' && r.status !== 'APPROVED',
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['calls'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createCallRequest(new Date(scheduledFor).toISOString(), note.trim() || undefined),
    onSuccess: () => {
      toast.success('Call request sent to your consultant');
      setNote('');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not schedule call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelCallRequest(id),
    onSuccess: () => {
      toast.success('Request cancelled');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not cancel');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCallRequest(id),
    onSuccess: () => {
      toast.success('Request approved');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not approve');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectCallRequest(id, reason),
    onSuccess: () => {
      toast.success('Request rejected');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not reject');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const startMutation = useMutation({
    mutationFn: (callRequestId: string) => startCall(callRequestId),
    onSuccess: (call) => {
      toast.success('Live call started — allow microphone access');
      invalidate();
      navigate(`/app/live-call/${call.id}`);
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not start call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const endOpenMutation = useMutation({
    mutationFn: (callId: string) => endCall(callId),
    onSuccess: () => {
      toast.success('Open call ended');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not end call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  function renderRequest(request: CallRequestItem) {
    return (
      <article
        key={request.id}
        className="rounded-xl border border-border bg-background/80 p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-serif text-base font-semibold text-foreground">
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
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
              statusClass(request.status),
            )}
          >
            {request.status}
          </span>
        </div>

        {!readOnly && !isConsultant && request.status === 'PENDING' ? (
          <TapButton
            className="mt-3 flex w-full items-center justify-center rounded-xl border border-border text-sm font-semibold"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate(request.id)}
          >
            Cancel request
          </TapButton>
        ) : null}

        {isConsultant && request.status === 'PENDING' ? (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <TapButton
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(request.id)}
              >
                <Check className="h-4 w-4" /> Approve
              </TapButton>
              <TapButton
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border text-sm font-semibold"
                disabled={rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
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

        {isConsultant &&
        request.status === 'APPROVED' &&
        !request.callSessionId ? (
          openCall ? (
            <div className="mt-3 space-y-2">
              <TapButton
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                onClick={() => navigate(`/app/live-call/${openCall.id}`)}
              >
                <Mic className="h-4 w-4" /> Rejoin live call
              </TapButton>
              <TapButton
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
                disabled={endOpenMutation.isPending}
                onClick={() => endOpenMutation.mutate(openCall.id)}
              >
                <PhoneOff className="h-4 w-4" />
                {endOpenMutation.isPending ? 'Ending…' : 'End open call'}
              </TapButton>
            </div>
          ) : (
            <TapButton
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate(request.id)}
            >
              <Phone className="h-4 w-4" />
              {startMutation.isPending ? 'Starting…' : 'Start live call'}
            </TapButton>
          )
        ) : null}

        {!isConsultant &&
        request.status === 'APPROVED' &&
        !request.callSessionId ? (
          <p className="mt-3 text-xs font-semibold text-success">
            Approved — wait for your consultant to start the live call, then
            join from this page.
          </p>
        ) : null}

        {request.status === 'APPROVED' && request.callSessionId ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Live call linked
              {openCall && openCall.id === request.callSessionId
                ? ' — still open until the consultant ends it.'
                : '.'}
            </p>
            {isConsultant &&
            openCall &&
            openCall.id === request.callSessionId ? (
              <div className="flex gap-2">
                <TapButton
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  onClick={() => navigate(`/app/live-call/${openCall.id}`)}
                >
                  <Mic className="h-4 w-4" /> Rejoin
                </TapButton>
                <TapButton
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
                  disabled={endOpenMutation.isPending}
                  onClick={() => endOpenMutation.mutate(openCall.id)}
                >
                  <PhoneOff className="h-4 w-4" />
                  {endOpenMutation.isPending ? 'Ending…' : 'End call'}
                </TapButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="mb-5 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gold-ink" />
          <p className="label-caps">
            {isConsultant ? 'Call requests' : 'Schedule a call'}
          </p>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {isConsultant
            ? 'Approve or reject student requests. Only you can start the live call after approval.'
            : 'Pick a date and time. Your consultant will approve or reject the request.'}
        </p>

        {!isConsultant && !readOnly ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (active.length > 0) {
                const current = active[0];
                toast.message(
                  current?.status === 'APPROVED'
                    ? 'Your call request is already approved'
                    : 'Your call is already requested',
                  {
                    description:
                      current?.status === 'APPROVED'
                        ? 'Wait for your consultant to start the live call, or check Active below.'
                        : 'Cancel the pending request below if you want to pick a new time.',
                  },
                );
                return;
              }
              createMutation.mutate();
            }}
          >
            {active.length > 0 ? (
              <div className="rounded-xl border border-gold/35 bg-gold-soft/60 px-3 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {active[0]?.status === 'APPROVED'
                    ? 'Call already approved'
                    : 'Call already requested'}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {active[0]?.status === 'APPROVED'
                    ? `Approved for ${formatSchedule(active[0].scheduledFor)}. Your consultant will start the live session — you can’t book another until this one finishes.`
                    : `Pending for ${formatSchedule(active[0].scheduledFor)}. Cancel it below if you want to choose a different time.`}
                </p>
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Date & time
              </span>
              <input
                type="datetime-local"
                required
                value={scheduledFor}
                min={toLocalInputValue(new Date())}
                disabled={active.length > 0}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)] disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Note (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={active.length > 0}
                placeholder="What would you like to discuss?"
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)] disabled:opacity-60"
              />
            </label>
            <TapButton
              type="submit"
              disabled={createMutation.isPending || active.length > 0}
              className="flex w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {createMutation.isPending
                ? 'Sending…'
                : active.length > 0
                  ? active[0]?.status === 'APPROVED'
                    ? 'Call already approved'
                    : 'Call already requested'
                  : 'Request call'}
            </TapButton>
          </form>
        ) : null}

        {readOnly ? (
          <p className="text-xs font-semibold text-muted-foreground">
            Guardians can view scheduled calls but cannot request or start them.
          </p>
        ) : null}
      </div>

      {requestsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-serif text-lg font-semibold">Active</h3>
          {active.map(renderRequest)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isConsultant
            ? 'No pending or approved requests for this student.'
            : 'No active call request.'}
        </p>
      )}

      {history.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-serif text-lg font-semibold">Past requests</h3>
          {history.slice(0, 5).map(renderRequest)}
        </div>
      ) : null}
    </div>
  );
}

function ConsultantEndOpenCallButton({ callId }: { callId: string }) {
  const queryClient = useQueryClient();
  const endMutation = useMutation({
    mutationFn: () => endCall(callId),
    onSuccess: () => {
      toast.success('Open call ended');
      void queryClient.invalidateQueries({ queryKey: ['calls'] });
      void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not end call');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  return (
    <TapButton
      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-semibold text-white"
      disabled={endMutation.isPending}
      onClick={() => endMutation.mutate()}
    >
      <PhoneOff className="h-4 w-4" />
      {endMutation.isPending ? 'Ending…' : 'End call'}
    </TapButton>
  );
}

export function MyConsultantPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ studentId?: string }>();
  const resolvedStudentId = studentId ?? params.studentId;
  const isConsultant = user?.role === 'CONSULTANT';
  const isGuardian = user?.role === 'GUARDIAN';

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', resolvedStudentId ?? 'self'],
    queryFn: () => fetchDashboard(resolvedStudentId),
    enabled: Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true),
  });

  const callsQuery = useQuery({
    queryKey: ['calls', resolvedStudentId ?? 'self'],
    queryFn: () => fetchCalls(resolvedStudentId),
    enabled: Boolean(user) && (isConsultant ? Boolean(resolvedStudentId) : true),
    refetchInterval: 4000,
  });

  if (isConsultant && !resolvedStudentId) {
    return (
      <PageMotion>
        <ScreenTitle eyebrow="Calls" title="Pick a student" />
        <p className="text-sm text-muted-foreground">
          Open a student dossier, then use Calls — or go back to your assigned
          list.
        </p>
        <TapButton
          className="mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
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
  const calls = callsQuery.data ?? [];
  const openCall = calls.find((c) => !c.endedAt) ?? null;

  return (
    <PageMotion>
      <div className="mb-3 flex items-center gap-2">
        <TapButton
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          onClick={() =>
            navigate(
              isConsultant && resolvedStudentId
                ? `/app/students/${resolvedStudentId}`
                : '/app/profile',
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </TapButton>
        <ScreenTitle
          eyebrow={isConsultant ? 'Student calls' : 'Support'}
          title={isConsultant ? 'Schedule & calls' : 'My Consultant'}
        />
      </div>

      {consultant ? (
        <div className="ivy-card mb-5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold bg-[#0B1528] font-serif text-xl text-primary-foreground">
              {consultant.fullName[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xl font-semibold">{consultant.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {consultant.title ?? 'Admissions Consultant'}
              </p>
              {!isConsultant ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Schedule a call below. Only your consultant can start the live
                  session after approving.
                </p>
              ) : null}
            </div>
            <UserRound className="h-5 w-5 text-gold-ink" />
          </div>
          <TapButton
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold"
            onClick={() =>
              navigate(
                isConsultant && resolvedStudentId
                  ? `/app/students/${resolvedStudentId}/messages`
                  : '/app/messages',
              )
            }
          >
            <MessageCircle className="h-4 w-4" /> Encrypted chat
          </TapButton>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">No consultant assigned.</p>
        </div>
      )}

      {!isConsultant && openCall ? (
        <div className="mb-5 rounded-2xl border border-success/30 bg-success/10 p-4">
          <p className="font-semibold text-foreground">Live call in progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your consultant started a call. Join to speak — your words are
            transcribed automatically.
          </p>
          <TapButton
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            onClick={() => navigate(`/app/live-call/${openCall.id}`)}
          >
            <Mic className="h-4 w-4" /> Join live call
          </TapButton>
        </div>
      ) : null}

      {isConsultant && openCall ? (
        <div className="mb-5 rounded-2xl border border-destructive/25 bg-destructive-soft/40 p-4">
          <p className="font-semibold text-foreground">Open call still running</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Leaving the live room without ending keeps the request in Active.
            End it here or reopen the room and tap End call.
          </p>
          <div className="mt-3 flex gap-2">
            <TapButton
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
              onClick={() => navigate(`/app/live-call/${openCall.id}`)}
            >
              <Mic className="h-4 w-4" /> Rejoin
            </TapButton>
            <ConsultantEndOpenCallButton callId={openCall.id} />
          </div>
        </div>
      ) : null}

      <CallSchedulingPanel
        studentId={resolvedStudentId}
        isConsultant={isConsultant}
        readOnly={isGuardian}
      />

      <ChatSchedulingPanel
        studentId={resolvedStudentId}
        isConsultant={isConsultant}
        readOnly={isGuardian}
      />

      <h2 className="mb-3 font-serif text-xl font-semibold">Saved calls</h2>
      {callsQuery.error ? (
        <p className="text-sm text-destructive">Could not load call history.</p>
      ) : calls.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-sm text-muted-foreground">
            No call sessions yet.
            {isConsultant
              ? ' Approve a request, then start the live call.'
              : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <CallCard key={call.id} call={call} />
          ))}
        </div>
      )}

      {!isConsultant ? (
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Need something else?{' '}
          <Link to="/app/profile" className="underline">
            Back to profile
          </Link>
        </p>
      ) : null}
    </PageMotion>
  );
}
