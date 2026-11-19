import { cn } from '../../lib/cn';
import { isOptimisticMessageId } from '../../lib/messagingCache';
import {
  formatMessageTime,
  type MessageTimelineItem,
} from '../../lib/messageGrouping';

export function MessageThread({
  items,
  peerTyping,
  bottomRef,
}: {
  items: MessageTimelineItem[];
  peerTyping: string | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 py-4">
      {items.map((item) => {
        if (item.type === 'date') {
          return (
            <div key={item.key} className="flex justify-center py-3">
              <span className="rounded-full bg-[#EBE8E0]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8B92A5]">
                {item.label}
              </span>
            </div>
          );
        }

        const { message, mine, showName, showMeta, isFirstInGroup, isLastInGroup } =
          item;
        const pending = isOptimisticMessageId(message.id);

        return (
          <div
            key={message.id}
            className={cn(
              'flex flex-col',
              mine ? 'items-end' : 'items-start',
              isFirstInGroup ? 'mt-2.5' : 'mt-0.5',
              pending && 'opacity-70',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] break-words px-3.5 py-2.5 text-sm leading-relaxed',
                mine
                  ? 'bg-[#111827] text-white'
                  : 'bg-white text-[#1E2430] shadow-[0_1px_2px_rgba(27,33,44,0.04)]',
                mine
                  ? cn(
                      'rounded-2xl',
                      isFirstInGroup && isLastInGroup && 'rounded-br-md',
                      isFirstInGroup && !isLastInGroup && 'rounded-br-md',
                      !isFirstInGroup && isLastInGroup && 'rounded-tr-md rounded-br-md',
                      !isFirstInGroup && !isLastInGroup && 'rounded-r-md',
                    )
                  : cn(
                      'rounded-2xl',
                      isFirstInGroup && isLastInGroup && 'rounded-bl-md',
                      isFirstInGroup && !isLastInGroup && 'rounded-bl-md',
                      !isFirstInGroup && isLastInGroup && 'rounded-tl-md rounded-bl-md',
                      !isFirstInGroup && !isLastInGroup && 'rounded-l-md',
                    ),
              )}
            >
              {showName ? (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8B92A5]">
                  {message.senderName}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap break-words font-medium">
                {message.body}
              </p>
            </div>
            {showMeta ? (
              <div
                className={cn(
                  'mt-1 flex items-center gap-1.5 px-1 text-[10px] font-medium text-[#8B92A5]',
                  mine ? 'justify-end' : 'justify-start',
                )}
              >
                <span>{formatMessageTime(message.createdAt)}</span>
                {mine && message.readAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Read</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {peerTyping ? (
        <div className="mt-2.5 flex justify-start" aria-live="polite">
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(27,33,44,0.04)]">
            <span className="sr-only">{peerTyping} is typing</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8B92A5]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8B92A5] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8B92A5] [animation-delay:300ms]" />
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}

export function MessageThreadSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-3 px-4 py-4"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className="skeleton ml-auto h-12 w-[70%]" />
      <div className="skeleton h-16 w-[75%]" />
      <div className="skeleton ml-auto h-10 w-[55%]" />
      <div className="skeleton h-12 w-[65%]" />
    </div>
  );
}
