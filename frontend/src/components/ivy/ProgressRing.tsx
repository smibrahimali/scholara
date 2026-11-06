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
    ? 'text-primary-foreground/80'
    : 'text-muted-foreground';

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="color-mix(in oklab, var(--primary-foreground) 20%, transparent)"
          strokeWidth="6"
        />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          className="stroke-gold"
          strokeWidth="6"
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
        <span className={`font-serif text-2xl font-semibold ${textClass}`}>
          {done}
          <span className="text-sm text-primary-foreground/80">/{safeTotal}</span>
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${subClass}`}>
          steps
        </span>
      </div>
    </div>
  );
}
