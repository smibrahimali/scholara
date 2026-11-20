import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

export function QuickActionCard({
  title,
  hint,
  icon: Icon,
  disabled,
  onClick,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-xl border border-[#E8E2D6] bg-white px-3 py-2.5 text-left',
        'shadow-[0_1px_2px_rgba(15,30,54,0.03)]',
        'transition-[border-color,box-shadow,transform,background-color] duration-150',
        'hover:-translate-y-px hover:border-[#E5CE96] hover:bg-[#FFFEFA] hover:shadow-[0_4px_12px_-8px_rgba(15,30,54,0.16)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E]/45 focus-visible:ring-offset-2',
        'active:translate-y-0 active:bg-[#FBF9F4]',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          'bg-[#FBF3DF] text-[#8A6212] ring-1 ring-[#E5CE96]/60',
          'transition-colors duration-150 group-hover:bg-[#F7E9C8]',
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold leading-snug text-[#1E2430]">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[#6B7280]">
          {hint}
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[#C5C0B6] transition-colors duration-150 group-hover:text-[#C8963E]"
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}
