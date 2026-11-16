import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  MessageCircle,
  MessageSquareOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { TapButton } from './ivy/TapButton';
import { cn } from '../lib/cn';
import { withFrom } from '../lib/navigation';
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
import type { ChatRequestItem } from '../types/domain';

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

function statusClass(status: ChatRequestItem['status']) {
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

export function ChatSchedulingPanel({
  studentId,
  isConsultant,
  readOnly,
}: {
  studentId?: string;
  isConsultant: boolean;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [scheduledFor, setScheduledFor] = useState(defaultScheduleValue);
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const messagesPath =
    isConsultant && studentId
      ? `/app/students/${studentId}/messages`
      : '/app/messages';
  const openMessages = () => navigate(messagesPath, withFrom(pathname));

  const requestsQuery = useQuery({
    queryKey: ['chat-requests', studentId ?? 'self'],
    queryFn: () =>
      fetchChatRequests(studentId ? { studentId } : undefined),
    refetchInterval: 5000,
  });

  const openSessionQuery = useQuery({
    queryKey: ['chat-session-open', studentId ?? 'self'],
    queryFn: () => fetchOpenChatSession(studentId),
    refetchInterval: 4000,
  });

  const openSession = openSessionQuery.data ?? null;
  const requests = requestsQuery.data ?? [];
  const active = requests.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const history = requests.filter(
    (r) => r.status !== 'PENDING' && r.status !== 'APPROVED',
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['chat-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['chat-session-open'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['consultant-students'] });
    void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createChatRequest(
        new Date(scheduledFor).toISOString(),
        note.trim() || undefined,
      ),
    onSuccess: () => {
      toast.success('Chat request sent to your consultant');
      setNote('');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not schedule chat');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelChatRequest(id),
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
    mutationFn: (id: string) => approveChatRequest(id),
    onSuccess: () => {
      toast.success('Chat request approved');
      invalidate();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not approve');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectChatRequest(id, reason),
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
    mutationFn: (chatRequestId: string) => startChatSession(chatRequestId),
    onSuccess: () => {
      toast.success('Encrypted chat started');
      invalidate();
      openMessages();
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not start chat');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  const endMutation = useMutation({
    mutationFn: (sessionId: string) => endChatSession(sessionId),
    onSuccess: () => {
      toast.success('Chat ended — messages cleared');
      invalidate();
      void queryClient.removeQueries({ queryKey: ['messaging-messages'] });
      void queryClient.removeQueries({ queryKey: ['messaging-conversation'] });
    },
    onError: (err) => {
      const msg = apiError(err, 'Could not end chat');
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    },
  });

  function renderRequest(request: ChatRequestItem) {
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
            className="btn-outline mt-3 flex w-full items-center justify-center rounded-xl text-sm font-semibold"
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
                className="flex flex-1 items-center justify-center gap-1 btn-primary rounded-xl text-sm font-semibold"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(request.id)}
              >
                <Check className="h-4 w-4" /> Approve
              </TapButton>
              <TapButton
                className="btn-outline flex flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
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
        !request.chatSessionId ? (
          openSession ? (
            <div className="mt-3 space-y-2">
              <TapButton
                className="flex w-full items-center justify-center gap-2 btn-primary rounded-xl text-sm font-semibold"
                onClick={openMessages}
              >
                <MessageCircle className="h-4 w-4" /> Open encrypted chat
              </TapButton>
              <TapButton
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
                disabled={endMutation.isPending}
                onClick={() => endMutation.mutate(openSession.id)}
              >
                <MessageSquareOff className="h-4 w-4" />
                {endMutation.isPending ? 'Ending…' : 'End open chat'}
              </TapButton>
            </div>
          ) : (
            <TapButton
              className="mt-3 flex w-full items-center justify-center gap-2 btn-primary rounded-xl text-sm font-semibold"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate(request.id)}
            >
              <MessageCircle className="h-4 w-4" />
              {startMutation.isPending ? 'Starting…' : 'Start encrypted chat'}
            </TapButton>
          )
        ) : null}

        {isConsultant &&
        request.status === 'APPROVED' &&
        request.chatSessionId &&
        openSession &&
        openSession.id === request.chatSessionId ? (
          <div className="mt-3 flex gap-2">
            <TapButton
              className="flex flex-1 items-center justify-center gap-2 btn-primary rounded-xl text-sm font-semibold"
              onClick={openMessages}
            >
              <MessageCircle className="h-4 w-4" /> Open chat
            </TapButton>
            <TapButton
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive text-sm font-semibold text-white"
              disabled={endMutation.isPending}
              onClick={() => endMutation.mutate(openSession.id)}
            >
              <MessageSquareOff className="h-4 w-4" />
              {endMutation.isPending ? 'Ending…' : 'End'}
            </TapButton>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="mb-5 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gold-ink" />
          <p className="label-caps">
            {isConsultant ? 'Chat requests' : 'Schedule a 1:1 chat'}
          </p>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {isConsultant
            ? 'Approve student chat requests, then start an encrypted room. Ending the chat clears all messages.'
            : 'Request a private encrypted chat. Your consultant approves, starts the room, and messages disappear when it ends.'}
        </p>

        {!isConsultant && !readOnly && active.length > 0 ? (
          <p className="rounded-xl border border-dashed border-[#D8CCB6] bg-[#FAF6EE]/70 px-3 py-2.5 text-xs font-semibold text-[#525B6B]">
            You already have an active chat request. Use{' '}
            <span className="text-foreground">Active Sessions</span> above, or
            cancel under Active chats below to request a new time.
          </p>
        ) : null}

        {!isConsultant && !readOnly && active.length === 0 ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (createMutation.isPending) return;
              createMutation.mutate();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Date & time
              </span>
              <input
                type="datetime-local"
                required
                value={scheduledFor}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)]"
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
                placeholder="What would you like to chat about?"
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)]"
              />
            </label>
            <TapButton
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex w-full items-center justify-center rounded-xl text-sm font-semibold"
            >
              {createMutation.isPending ? 'Sending…' : 'Request 1:1 chat'}
            </TapButton>
          </form>
        ) : null}

        {readOnly ? (
          <p className="text-xs font-semibold text-muted-foreground">
            Guardians can view chat requests but cannot start them.
          </p>
        ) : null}
      </div>

      {requestsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading chat requests…</p>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-serif text-lg font-semibold">Active chats</h3>
          {active.map(renderRequest)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isConsultant
            ? 'No pending or approved chat requests for this student.'
            : 'No active chat request.'}
        </p>
      )}

      {history.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-serif text-lg font-semibold">Past chat requests</h3>
          {history.slice(0, 5).map(renderRequest)}
        </div>
      ) : null}
    </div>
  );
}
