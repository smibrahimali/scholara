import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Loader2, Send } from 'lucide-react';
import { cn } from '../../lib/cn';

export const ChatComposer = forwardRef<
  HTMLTextAreaElement,
  {
    draft: string;
    onDraftChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    disabled?: boolean;
    sending?: boolean;
    placeholder?: string;
  }
>(function ChatComposer(
  {
    draft,
    onDraftChange,
    onSubmit,
    disabled,
    sending,
    placeholder = 'Ask a question about your application…',
  },
  ref,
) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

  const canSend = Boolean(draft.trim()) && !disabled && !sending;

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 96); // ~4 lines
    el.style.height = `${next}px`;
  }, [draft]);

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'flex shrink-0 items-end gap-2 border-t border-[#E8E2D6] bg-[#F3F2EE] px-3 pt-2.5',
        'pb-[max(0.65rem,env(safe-area-inset-bottom,0px))]',
      )}
    >
      <textarea
        ref={localRef}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value.slice(0, 4000))}
        rows={1}
        maxLength={4000}
        disabled={disabled || sending}
        placeholder={placeholder}
        aria-label="Message to Scholara Assistant"
        className={cn(
          'max-h-24 min-h-11 flex-1 resize-none overflow-y-auto rounded-[1.25rem] border border-[#E8E2D6] bg-white',
          'px-3.5 py-2.5 text-sm leading-snug text-[#1E2430]',
          'shadow-[inset_0_1px_1px_rgba(15,30,54,0.03)] outline-none',
          'placeholder:text-[#6B7280]',
          'transition-[border-color,box-shadow] duration-150',
          'focus:border-[#C8963E] focus:shadow-[0_0_0_3px_rgba(200,150,62,0.16)]',
          'disabled:bg-[#F3F2F0] disabled:text-[#9CA3AF]',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSubmit(e);
          }
        }}
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label={sending ? 'Sending message' : 'Send message'}
        className={cn(
          'mb-0.5 flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[1.1rem] border transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/50 focus-visible:ring-offset-2',
          canSend
            ? 'border-transparent bg-[#C8963E] text-[#0F1E36] shadow-[0_2px_6px_rgba(200,150,62,0.35)] hover:bg-[#D4A84A]'
            : 'border-[#E8E2D6] bg-[#EEEBE4] text-[#A39B8C]',
        )}
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Send className="h-3.5 w-3.5" strokeWidth={1.85} />
        )}
      </button>
    </form>
  );
});
