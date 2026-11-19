import { motion, useReducedMotion } from 'framer-motion';

export function ProgressRing({
  done,
  total,
  light = true,
}: {
  done: number;
  total: number;
  light?: boolean;
}) {
  const reduce = useReducedMotion();
  const safeTotal = Math.max(total, 1);
  const r = 34;
  const c = 2 * Math.PI * r;
  const textClass = light ? 'text-primary-foreground' : 'text-foreground';
  const subClass = light
    ? 'text-primary-foreground/70'
    : 'text-muted-foreground';

  return (
    <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 sm:h-24 sm:w-24">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="color-mix(in oklab, var(--primary-foreground) 18%, transparent)"
          strokeWidth="5.5"
        />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          className="stroke-gold"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (done / safeTotal) * c }}
          transition={{
            duration: reduce ? 0 : 0.9,
            ease: 'easeOut',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-serif text-[1.35rem] font-semibold leading-none ${textClass}`}>
          {done}
          <span className="text-xs font-medium text-primary-foreground/65">
            /{safeTotal}
          </span>
        </span>
        <span
          className={`mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.1em] ${subClass}`}
        >
          steps
        </span>
      </div>
    </div>
  );
}
