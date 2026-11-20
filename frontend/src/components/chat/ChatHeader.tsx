import type { ReactNode } from 'react';
import { Home, Trash2, X } from 'lucide-react';
import { CrestMark } from '../ivy/CrestMark';
import { cn } from '../../lib/cn';

export type ChatHeaderStatus = 'online' | 'thinking' | 'unavailable';

export function ChatHeader({
  status,
  deskLabel,
  canClear,
  clearPending,
  onHome,
  onClear,
  onClose,
}: {
  status: ChatHeaderStatus;
  deskLabel: string;
  canClear: boolean;
  clearPending: boolean;
  onHome: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const statusLabel =
    status === 'unavailable'
      ? `Unavailable · ${deskLabel}`
      : status === 'thinking'
        ? `Thinking · ${deskLabel}`
        : `Online · ${deskLabel}`;

  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between gap-2.5 bg-[#0F1E36] px-3.5 py-2.5 text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_6px_18px_-14px_rgba(15,30,54,0.5)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <CrestMark size={24} />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-sans text-[14px] font-semibold tracking-tight text-white">
            Scholara Assistant
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-slate-300/90">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200',
                status === 'unavailable'
                  ? 'bg-amber-400'
                  : status === 'thinking'
                    ? 'animate-pulse bg-[#E6C365]'
                    : 'bg-emerald-400',
              )}
              aria-hidden
            />
            <span className="truncate">{statusLabel}</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderIconButton label="Assistant home menu" onClick={onHome}>
          <Home className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.6} />
        </HeaderIconButton>
        <HeaderIconButton
          label="Clear chat"
          onClick={onClear}
          disabled={clearPending || !canClear}
        >
          <Trash2 className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.6} />
        </HeaderIconButton>
        <HeaderIconButton label="Close chat" onClick={onClose}>
          <X className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.6} />
        </HeaderIconButton>
      </div>
    </header>
  );
}

function HeaderIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        onClick();
        // Avoid a stuck :focus ring after tap on touch devices.
        e.currentTarget.blur();
      }}
      className={cn(
        'flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-xl',
        'bg-transparent text-slate-300',
        'transition-colors duration-150',
        'hover:bg-white/10 hover:text-white',
        'active:bg-white/15 active:text-white',
        'focus:outline-none focus-visible:bg-white/10 focus-visible:text-white',
        'focus-visible:ring-2 focus-visible:ring-[#E6C365]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1E36]',
        'disabled:pointer-events-none disabled:bg-transparent disabled:text-slate-500 disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}
