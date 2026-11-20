import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export type SuggestionChipItem = {
  title: string;
  prompt: string;
  icon: LucideIcon;
};

export function SuggestionChips({
  items,
  disabled,
  onSelect,
}: {
  items: SuggestionChipItem[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div
      className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1"
      role="list"
      aria-label="Quick suggestions"
    >
      {items.map(({ title, prompt, icon: Icon }) => (
        <button
          key={title}
          type="button"
          role="listitem"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#DEC484] bg-[#FFFDF9]',
            'px-3 py-1.5 text-[11.5px] font-semibold text-[#0F1E36]',
            'transition-colors duration-150',
            'hover:bg-[#FBF3DF]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/45 focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <Icon className="h-3 w-3 text-[#C8963E]" strokeWidth={1.85} aria-hidden />
          {title}
        </button>
      ))}
    </div>
  );
}
