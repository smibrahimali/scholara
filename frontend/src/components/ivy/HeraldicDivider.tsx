import { cn } from '../../lib/cn';

/** Classical hairline with centered diamond accent */
export function HeraldicDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex w-full max-w-[11rem] items-center gap-2', className)} aria-hidden>
      <span
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklab, var(--gold) 75%, transparent))',
        }}
      />
      <span className="font-serif text-[10px] leading-none text-gold-ink">◆</span>
      <span
        className="h-px flex-1"
        style={{
          background:
            'linear-gradient(270deg, transparent, color-mix(in oklab, var(--gold) 75%, transparent))',
        }}
      />
    </div>
  );
}
