import { CrestMark } from '../ivy/CrestMark';

export function TypingIndicator({ label = 'Reviewing dossier…' }: { label?: string }) {
  return (
    <div
      className="flex items-end gap-2"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F1E36] ring-1 ring-[#E5CE96]/40">
        <CrestMark size={16} />
      </span>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#E8E2D6] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,30,54,0.04)]">
        <span className="chat-typing-dots flex items-center gap-1" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className="text-[11px] font-medium text-[#8B92A5]">{label}</span>
      </div>
    </div>
  );
}
