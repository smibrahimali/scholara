import type { QueryClient } from '@tanstack/react-query';
import type { DirectMessageItem } from '../types/domain';

export const OPTIMISTIC_MESSAGE_PREFIX = 'optimistic-';

export function isOptimisticMessageId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_MESSAGE_PREFIX);
}

export function messagingMessagesKey(conversationId: string | undefined) {
  return ['messaging-messages', conversationId] as const;
}

export function sortDirectMessages(
  messages: DirectMessageItem[],
): DirectMessageItem[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Keep optimistic rows + recent cache-only rows when a poll snapshot is behind. */
export function mergeFetchedMessages(
  fresh: DirectMessageItem[],
  existing: DirectMessageItem[] | undefined,
  retainMs = 60_000,
): DirectMessageItem[] {
  const byId = new Map<string, DirectMessageItem>();
  for (const message of fresh) {
    byId.set(message.id, message);
  }

  const cutoff = Date.now() - retainMs;
  for (const message of existing ?? []) {
    if (byId.has(message.id)) continue;
    if (isOptimisticMessageId(message.id)) {
      byId.set(message.id, message);
      continue;
    }
    const created = new Date(message.createdAt).getTime();
    if (!Number.isNaN(created) && created >= cutoff) {
      byId.set(message.id, message);
    }
  }

  return sortDirectMessages([...byId.values()]);
}

export function upsertDirectMessage(
  queryClient: QueryClient,
  conversationId: string,
  message: DirectMessageItem,
): void {
  queryClient.setQueryData<DirectMessageItem[]>(
    messagingMessagesKey(conversationId),
    (prev) => {
      let list = prev ?? [];
      if (list.some((item) => item.id === message.id)) {
        return list;
      }

      let removedOptimistic = false;
      list = list.filter((item) => {
        if (removedOptimistic) return true;
        if (
          isOptimisticMessageId(item.id) &&
          item.senderUserId === message.senderUserId &&
          item.body === message.body
        ) {
          removedOptimistic = true;
          return false;
        }
        return true;
      });

      return sortDirectMessages([...list, message]);
    },
  );
}

export function replaceOptimisticMessage(
  queryClient: QueryClient,
  conversationId: string,
  optimisticId: string,
  message: DirectMessageItem,
): void {
  queryClient.setQueryData<DirectMessageItem[]>(
    messagingMessagesKey(conversationId),
    (prev) => {
      const list = (prev ?? []).filter(
        (item) => item.id !== optimisticId && item.id !== message.id,
      );
      return sortDirectMessages([...list, message]);
    },
  );
}

export function removeDirectMessage(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
): void {
  queryClient.setQueryData<DirectMessageItem[]>(
    messagingMessagesKey(conversationId),
    (prev) => (prev ?? []).filter((item) => item.id !== messageId),
  );
}
