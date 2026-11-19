import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BackLink } from '../components/ivy/BackLink';
import { PageMotion } from '../components/ivy/PageMotion';
import { ConversationHeader } from '../components/messaging/ConversationHeader';
import { EmptyConversation } from '../components/messaging/EmptyConversation';
import { MessageComposer } from '../components/messaging/MessageComposer';
import {
  MessageThread,
  MessageThreadSkeleton,
} from '../components/messaging/MessageThread';
import { useAuth } from '../context/AuthContext';
import { useMessagingSocket } from '../hooks/useMessagingSocket';
import { buildMessageTimeline } from '../lib/messageGrouping';
import {
  mergeFetchedMessages,
  messagingMessagesKey,
  OPTIMISTIC_MESSAGE_PREFIX,
  removeDirectMessage,
  replaceOptimisticMessage,
  upsertDirectMessage,
} from '../lib/messagingCache';
import { getBackPath } from '../lib/navigation';
import {
  fetchConversationMessages,
  fetchConversations,
  fetchOrCreateConversation,
  markConversationRead,
  sendDirectMessage,
} from '../services/messagingApi';
import type { ConversationItem, DirectMessageItem } from '../types/domain';

export function MessagesPage({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const params = useParams<{ studentId?: string }>();
  const resolvedStudentId = studentId ?? params.studentId;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);

  const canSend = user?.role === 'STUDENT' || user?.role === 'CONSULTANT';
  const readOnly = user?.role === 'GUARDIAN';

  const conversationQuery = useQuery({
    queryKey: [
      'messaging-conversation',
      resolvedStudentId ?? 'self',
      user?.role,
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
    enabled: Boolean(user),
  });

  const conversationId = conversationQuery.data?.id;

  const { connected, peerTyping, sendMessage, setTyping } = useMessagingSocket({
    conversationId,
    enabled: Boolean(conversationId) && canSend,
    onMessage: (message) => {
      if (!conversationId) return;
      upsertDirectMessage(queryClient, conversationId, message);
    },
  });

  const historyQuery = useQuery({
    queryKey: messagingMessagesKey(conversationId),
    queryFn: async () => {
      const fresh = await fetchConversationMessages(conversationId!);
      const existing = queryClient.getQueryData<DirectMessageItem[]>(
        messagingMessagesKey(conversationId),
      );
      return mergeFetchedMessages(fresh, existing);
    },
    enabled: Boolean(conversationId),
    // WhatsApp-style: history is source of truth; light poll catches peer messages
    // even when they send while you're not on a live socket path.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      if (!conversationId || query.state.status === 'error') return false;
      return connected ? 12_000 : 5_000;
    },
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === conversationId
        ? previousData
        : undefined,
  });

  // Mark read once per conversation join — not on every history refetch.
  useEffect(() => {
    if (!conversationId) return;
    void markConversationRead(conversationId).catch(() => undefined);
  }, [conversationId]);

  const messages = historyQuery.data ?? [];

  const timeline = useMemo(
    () => buildMessageTimeline(messages, user?.id),
    [messages, user?.id],
  );

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId || !canSend || !user) {
      return;
    }

    const optimisticId = `${OPTIMISTIC_MESSAGE_PREFIX}${crypto.randomUUID()}`;
    const optimistic: DirectMessageItem = {
      id: optimisticId,
      conversationId,
      chatSessionId: null,
      senderUserId: user.id,
      senderName: user.fullName,
      body,
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    setTyping(false);
    setDraft('');

    await queryClient.cancelQueries({
      queryKey: messagingMessagesKey(conversationId),
    });
    upsertDirectMessage(queryClient, conversationId, optimistic);

    try {
      let message: DirectMessageItem;
      if (connected) {
        try {
          message = await sendMessage(body);
        } catch (err) {
          const reason = err instanceof Error ? err.message : '';
          // Timeout may mean the server already saved — reconcile, do not double-POST.
          if (/timed out/i.test(reason)) {
            const fresh = await fetchConversationMessages(conversationId);
            const matched = [...fresh]
              .reverse()
              .find(
                (m) =>
                  m.senderUserId === user.id &&
                  m.body === body &&
                  Date.now() - new Date(m.createdAt).getTime() < 30_000,
              );
            if (matched) {
              replaceOptimisticMessage(
                queryClient,
                conversationId,
                optimisticId,
                matched,
              );
              return;
            }
          }
          // Async chat: always persist via REST if the live path fails.
          message = await sendDirectMessage(conversationId, body);
        }
      } else {
        message = await sendDirectMessage(conversationId, body);
      }
      replaceOptimisticMessage(
        queryClient,
        conversationId,
        optimisticId,
        message,
      );
    } catch {
      removeDirectMessage(queryClient, conversationId, optimisticId);
      toast.error('Could not send message');
      setDraft((prev) => (prev.trim() ? prev : body));
    }
  }

  function onDraftChange(value: string) {
    setDraft(value);
    if (!canSend) return;
    // Keep input snappy; throttle only the socket typing emit.
    const now = Date.now();
    if (now - lastTypingEmit.current >= 800) {
      lastTypingEmit.current = now;
      setTyping(true);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(false), 1200);
  }

  function onSelectPrompt(prompt: string) {
    setDraft(prompt);
    setComposerFocusToken((n) => n + 1);
  }

  const peerName =
    user?.role === 'CONSULTANT'
      ? conversationQuery.data?.studentName ?? 'Student'
      : conversationQuery.data?.consultantName ?? 'Consultant';

  const roleLabel =
    user?.role === 'CONSULTANT'
      ? 'Student'
      : conversationQuery.data?.consultantTitle ?? 'Your consultant';

  const backFallback =
    resolvedStudentId && user?.role === 'CONSULTANT'
      ? `/app/students/${resolvedStudentId}`
      : '/app';
  const backTo = getBackPath(location, backFallback);

  if (conversationQuery.isLoading) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col"
        aria-busy="true"
        aria-label="Opening chat"
      >
        <div className="flex items-center gap-2.5 border-b border-[#EBE8E0]/90 px-4 py-2.5">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
        <MessageThreadSkeleton />
      </div>
    );
  }

  if (conversationQuery.error || !conversationQuery.data) {
    return (
      <PageMotion className="px-5">
        <BackLink to={backTo} className="mb-4" />
        <div className="ivy-card flex flex-col items-center px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
            <MessageCircle className="h-5 w-5" />
          </span>
          <p className="editorial-title text-lg text-foreground">
            Messaging unavailable
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {readOnly
              ? 'No messages yet for your linked student.'
              : 'Could not open the conversation. Check that a consultant is assigned, then try again.'}
          </p>
          <BackLink to={backTo} label="Go back" className="mt-4 mb-0" />
        </div>
      </PageMotion>
    );
  }

  return (
    <PageMotion className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col bg-[#F3F2F0]">
        <ConversationHeader
          backTo={backTo}
          peerName={peerName}
          roleLabel={roleLabel}
          statusLabel="Messages are saved"
          readOnly={readOnly}
        />

        {historyQuery.isLoading ? (
          <MessageThreadSkeleton />
        ) : historyQuery.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#1E2430]">
              Could not load messages
            </p>
            <p className="mt-1 max-w-xs text-sm text-[#8B92A5]">
              Your chat history is saved — try again in a moment.
            </p>
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-[#8A6212] underline-offset-2 hover:underline"
              onClick={() => void historyQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <EmptyConversation
            readOnly={readOnly}
            onSelectPrompt={canSend ? onSelectPrompt : undefined}
          />
        ) : (
          <MessageThread
            items={timeline}
            peerTyping={peerTyping}
            bottomRef={bottomRef}
          />
        )}

        {canSend ? (
          <MessageComposer
            draft={draft}
            peerName={peerName}
            sending={false}
            focusToken={composerFocusToken}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
          />
        ) : (
          <p className="shrink-0 border-t border-[#EBE8E0]/90 bg-[#F9F8F6] px-4 py-3.5 text-center text-sm text-[#8B92A5]">
            Guardians can view messages but cannot reply.
          </p>
        )}
      </div>
    </PageMotion>
  );
}
