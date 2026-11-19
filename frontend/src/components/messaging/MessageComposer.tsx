import { useEffect, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import { TapButton } from '../ivy/TapButton';
import { cn } from '../../lib/cn';

export function MessageComposer({
  draft,
  peerName,
  sending,
  focusToken = 0,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  peerName: string;
  sending: boolean;
  /** Increment to move keyboard focus into the composer. */
  focusToken?: number;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [draft]);

  useEffect(() => {
    if (!focusToken) return;
    textareaRef.current?.focus();
    const el = textareaRef.current;
    if (el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [focusToken]);

  const canSend = Boolean(draft.trim()) && !sending;

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-[#EBE8E0]/90 bg-[#F9F8F6] px-3 py-2.5"
      style={{
        paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={1}
          placeholder={`Message ${peerName}…`}
          aria-label={`Message ${peerName}`}
          className={cn(
            'max-h-28 min-h-11 flex-1 resize-none rounded-[1.25rem] border border-[#EBE8E0] bg-white px-4 py-2.5 text-sm text-[#1E2430]',
            'shadow-[inset_0_1px_2px_rgba(27,33,44,0.03)] outline-none transition-shadow',
            'placeholder:text-[#9CA3AF]',
            'focus:border-[#C8963E] focus:shadow-[0_0_0_2px_rgba(200,150,62,0.22)]',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        <TapButton
          type="submit"
          disabled={!canSend}
          aria-label={sending ? 'Sending message' : 'Send message'}
          className={cn(
            'flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors',
            canSend
              ? 'border-transparent bg-[#111827] text-[#E6C365] shadow-[0_2px_8px_rgba(17,24,39,0.18)] disabled:bg-[#111827] disabled:text-[#E6C365]'
              : 'border-[#EBE8E0] bg-[#F3F2F0] text-[#9CA3AF]',
          )}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" strokeWidth={1.75} />
          )}
        </TapButton>
      </div>
    </form>
  );
}
