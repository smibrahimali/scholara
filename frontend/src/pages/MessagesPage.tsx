import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  MessageSquareOff,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { useMessagingSocket } from '../hooks/useMessagingSocket';
import { cn } from '../lib/cn';
import { getBackPath } from '../lib/navigation';
import {
  endChatSession,
  fetchConversationMessages,
  fetchConversations,
  fetchOpenChatSession,
  fetchOrCreateConversation,
  markConversationRead,
  sendDirectMessage,
} from '../services/messagingApi';
import type { ConversationItem, DirectMessageItem } from '../types/domain';

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MessagesPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ studentId?: string }>();
  const resolvedStudentId = studentId ?? params.studentId;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [liveMessages, setLiveMessages] = useState<DirectMessageItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSend =
    user?.role === 'STUDENT' || user?.role === 'CONSULTANT';
  const readOnly = user?.role === 'GUARDIAN';
  const isConsultant = user?.role === 'CONSULTANT';

  const schedulePath =
    isConsultant && resolvedStudentId
      ? `/app/students/${resolvedStudentId}/calls`
      : '/app/consultant';

  const openSessionQuery = useQuery({
    queryKey: ['chat-session-open', resolvedStudentId ?? 'self'],
    queryFn: () => fetchOpenChatSession(resolvedStudentId),
    enabled: Boolean(user),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      return query.state.data ? 4000 : 30_000;
    },
  });

  const openSession = openSessionQuery.data ?? null;

  const conversationQuery = useQuery({
    queryKey: [
      'messaging-conversation',
      resolvedStudentId ?? 'self',
      user?.role,
      openSession?.id ?? 'none',
    ],
    queryFn: async (): Promise<ConversationItem> => {
      if (user?.role === 'GUARDIAN') {
        const list = await fetchConversations();
        if (!list[0]) {
          throw new Error('No conversation yet');
        }
        return list[0];
      }
      return fetchOrCreateConversation(resolvedStudentId);
    },
    enabled: Boolean(user) && Boolean(openSession),
  });

  const conversationId = conversationQuery.data?.id;

  const historyQuery = useQuery({
    queryKey: ['messaging-messages', conversationId, openSession?.id],
    queryFn: () => fetchConversationMessages(conversationId!),
    enabled: Boolean(conversationId) && Boolean(openSession),
    refetchInterval: openSession ? 5000 : false,
  });

  useEffect(() => {
    setLiveMessages([]);
  }, [conversationId, openSession?.id]);

  useEffect(() => {
    if (!conversationId || !openSession) return;
    void markConversationRead(conversationId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .catch(() => undefined);
  }, [conversationId, openSession, historyQuery.dataUpdatedAt, queryClient]);

  const messages = useMemo(() => {
    const history = historyQuery.data ?? [];
    const byId = new Map<string, DirectMessageItem>();
    for (const m of history) byId.set(m.id, m);
    for (const m of liveMessages) byId.set(m.id, m);
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [historyQuery.data, liveMessages]);

  const { connected, peerTyping, sendMessage, setTyping } = useMessagingSocket({
    conversationId,
    enabled: Boolean(conversationId) && canSend && Boolean(openSession),
    onMessage: (message) => {
      setLiveMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      void queryClient.invalidateQueries({
        queryKey: ['messaging-messages', conversationId],
        refetchType: 'none',
      });
    },
  });

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, peerTyping]);

  const restSendMutation = useMutation({
    mutationFn: (body: string) =>
      sendDirectMessage(conversationId!, body),
    onSuccess: (message) => {
      setLiveMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setDraft('');
    },
    onError: () => toast.error('Could not send message'),
  });

  const endMutation = useMutation({
    mutationFn: () => endChatSession(openSession!.id),
    onSuccess: () => {
      toast.success('Chat ended — messages cleared');
      setLiveMessages([]);
      void queryClient.invalidateQueries({ queryKey: ['chat-session-open'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['call-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['consultant-students'] });
      void queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
      void queryClient.removeQueries({ queryKey: ['messaging-messages'] });
      void queryClient.removeQueries({ queryKey: ['messaging-conversation'] });
      navigate(schedulePath);
    },
    onError: () => toast.error('Could not end chat'),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (
      !body ||
      !conversationId ||
      !canSend ||
      !openSession ||
      sending ||
      restSendMutation.isPending
    ) {
      return;
    }
    setTyping(false);
    setSending(true);
    try {
      if (connected) {
        const message = await sendMessage(body);
        setLiveMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        setDraft('');
      } else {
        restSendMutation.mutate(body);
      }
    } catch {
      restSendMutation.mutate(body);
    } finally {
      setSending(false);
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (!canSend) return;
    setTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(false), 1200);
  }

  const peerName =
    user?.role === 'CONSULTANT'
      ? conversationQuery.data?.studentName ??
        openSession?.studentName ??
        'Student'
      : conversationQuery.data?.consultantName ??
        openSession?.consultantName ??
        'Consultant';

  const backFallback =
    resolvedStudentId && user?.role === 'CONSULTANT'
      ? `/app/students/${resolvedStudentId}`
      : '/app';
  const backTo = getBackPath(location, backFallback);

  if (openSessionQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Checking encrypted chat…</p>
    );
  }

  if (!openSession) {
    return (
      <PageMotion>
        <Link
          to={backTo}
          className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted-foreground no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="ivy-card flex flex-col items-center px-6 py-12 text-center">
          <span className="ivy-medallion mb-3 flex h-12 w-12 items-center justify-center rounded-full">
            <MessageCircle className="h-5 w-5" />
          </span>
          <p className="font-serif text-lg font-semibold text-foreground">
            No encrypted chat open
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {readOnly
              ? 'No live encrypted room right now. Guardians can follow updates from Support once the student and consultant open a chat.'
              : 'No live room yet. Go back to Support, schedule a 1:1 chat below the consultant card, and return here after your consultant starts the room.'}
          </p>
          <TapButton
            className="btn-outline mt-5 rounded-xl px-4 py-3 text-sm font-semibold"
            onClick={() => navigate(schedulePath)}
          >
            Back to Support
          </TapButton>
        </div>
      </PageMotion>
    );
  }

  if (conversationQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Opening conversation…</p>;
  }
  if (conversationQuery.error || !conversationQuery.data) {
    return (
      <div className="ivy-card flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <MessageCircle className="h-5 w-5" />
        </span>
        <p className="font-serif text-lg font-semibold text-foreground">
          Messaging unavailable
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Could not open the encrypted room. Try again from My Consultant.
        </p>
        <Link
          to={backTo}
          className="mt-4 inline-flex text-sm font-semibold text-gold-ink no-underline"
        >
          Go back
        </Link>
      </div>
    );
  }

  return (
    <PageMotion>
      <div className="space-y-5">
        <Link
          to={backTo}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted-foreground no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div>
          <ScreenTitle
            eyebrow={
              user?.role === 'CONSULTANT'
                ? 'Encrypted 1:1'
                : conversationQuery.data.consultantTitle ?? 'Your consultant'
            }
            title={peerName}
          />
          <p className="-mt-2 text-sm text-muted-foreground">
            {connected
              ? 'Live · ephemeral encrypted channel'
              : 'Connecting… · REST fallback ready'}
            {readOnly ? ' · View only' : ''}
          </p>
        </div>

        {isConsultant ? (
          <TapButton
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive-soft/50 py-3 text-sm font-semibold text-destructive"
            disabled={endMutation.isPending}
            onClick={() => endMutation.mutate()}
          >
            <MessageSquareOff className="h-4 w-4" />
            {endMutation.isPending ? 'Ending…' : 'End chat & clear messages'}
          </TapButton>
        ) : (
          <TapButton
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground"
            onClick={() => navigate(schedulePath)}
          >
            <ArrowLeft className="h-4 w-4" />
            Leave chat
          </TapButton>
        )}

        <div className="ivy-card flex min-h-[52dvh] flex-1 flex-col overflow-hidden">
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {historyQuery.isLoading ? (
              <p className="text-center text-sm text-muted-foreground">
                Loading messages…
              </p>
            ) : null}
            {!historyQuery.isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="ivy-medallion mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <p className="font-serif text-base font-semibold text-foreground">
                  Room is open
                </p>
                <p className="mt-1.5 max-w-[16rem] text-sm text-muted-foreground">
                  Messages only live in this session. They are wiped when the
                  consultant ends the chat.
                </p>
              </div>
            ) : null}
            {messages.map((m) => {
              const mine = m.senderUserId === user?.id;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    mine
                      ? 'ml-auto rounded-br-md bg-[#0B1528] text-primary-foreground'
                      : 'mr-auto rounded-bl-md bg-secondary text-foreground',
                  )}
                >
                  {!mine ? (
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {m.senderName}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap font-semibold">{m.body}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px] font-medium',
                      mine
                        ? 'text-primary-foreground/65'
                        : 'text-muted-foreground',
                    )}
                  >
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              );
            })}
            {peerTyping ? (
              <p className="text-sm text-muted-foreground">
                {peerTyping} is typing…
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {canSend ? (
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 border-t border-black/[0.06] bg-card px-3 py-2.5"
            >
              <textarea
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                rows={1}
                placeholder={`Message ${peerName}…`}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-black/[0.06] bg-background px-3 py-2.5 text-sm outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onSubmit(e);
                  }
                }}
              />
              <TapButton
                type="submit"
                disabled={
                  !draft.trim() || sending || restSendMutation.isPending
                }
                className="btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </TapButton>
            </form>
          ) : (
            <p className="border-t border-black/[0.06] px-4 py-3.5 text-center text-sm text-muted-foreground">
              Guardians can view this session but cannot reply.
            </p>
          )}
        </div>
      </div>
    </PageMotion>
  );
}
