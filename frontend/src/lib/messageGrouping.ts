import type { DirectMessageItem } from '../types/domain';

/** Consecutive same-sender messages within this window share a group. */
export const MESSAGE_GROUP_MS = 3 * 60 * 1000;

export type MessageTimelineItem =
  | { type: 'date'; key: string; label: string }
  | {
      type: 'message';
      message: DirectMessageItem;
      mine: boolean;
      showName: boolean;
      showMeta: boolean;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateSeparator(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const day = startOfDay(d);
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;

  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function buildMessageTimeline(
  messages: DirectMessageItem[],
  currentUserId: string | undefined,
  now = new Date(),
): MessageTimelineItem[] {
  const items: MessageTimelineItem[] = [];
  let lastDay: string | null = null;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]!;
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const mine = message.senderUserId === currentUserId;

    const day = dayKey(message.createdAt);
    if (day !== lastDay) {
      items.push({
        type: 'date',
        key: `date-${day}-${message.id}`,
        label: formatDateSeparator(message.createdAt, now),
      });
      lastDay = day;
    }

    const sameAsPrev =
      Boolean(prev) &&
      prev!.senderUserId === message.senderUserId &&
      dayKey(prev!.createdAt) === day &&
      Math.abs(
        new Date(message.createdAt).getTime() -
          new Date(prev!.createdAt).getTime(),
      ) <= MESSAGE_GROUP_MS;

    const sameAsNext =
      Boolean(next) &&
      next!.senderUserId === message.senderUserId &&
      dayKey(next!.createdAt) === day &&
      Math.abs(
        new Date(next!.createdAt).getTime() -
          new Date(message.createdAt).getTime(),
      ) <= MESSAGE_GROUP_MS;

    const isFirstInGroup = !sameAsPrev;
    const isLastInGroup = !sameAsNext;

    items.push({
      type: 'message',
      message,
      mine,
      showName: !mine && isFirstInGroup,
      showMeta: isLastInGroup,
      isFirstInGroup,
      isLastInGroup,
    });
  }

  return items;
}
