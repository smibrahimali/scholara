import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-transparent p-10 text-center',
        className,
      )}
    >
      <Icon
        className="mb-3 h-12 w-12 text-slate-300"
        strokeWidth={1}
        aria-hidden
      />
      <p className="font-sans text-base font-semibold text-[#1E2430]">{title}</p>
      {description ? (
        <p className="mt-2 max-w-xs text-sm font-normal leading-relaxed text-[#8B92A5]">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
