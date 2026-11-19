import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Standard in-app back control — circular icon button with soft elevation. */
export function BackLink({
  to,
  label = 'Back',
  className,
}: {
  to: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn(
        'mb-3 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#EBE8E0] bg-card text-[#1E2430] no-underline',
        'shadow-[0_1px_3px_rgba(27,33,44,0.06),0_1px_2px_rgba(27,33,44,0.04)]',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
    </Link>
  );
}
