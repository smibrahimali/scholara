import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import type { DocumentStatus } from '../../types/domain';

export type DocStatus = 'verified' | 'review' | 'rejected' | 'pending';

const badgeStyles: Record<DocStatus, string> = {
  verified: 'bg-success-soft text-success',
  review: 'bg-gold-soft text-gold-ink',
  rejected: 'bg-destructive-soft text-destructive',
  pending: 'bg-secondary text-muted-foreground',
};

const badgeLabel: Record<DocStatus, string> = {
  verified: '✓ Verified',
  review: '◷ Under Review',
  rejected: '✕ Rejected',
  pending: 'Not uploaded',
};

export function toDocStatus(status: DocumentStatus): DocStatus {
  switch (status) {
    case 'VERIFIED':
      return 'verified';
    case 'UNDER_REVIEW':
      return 'review';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'pending';
  }
}

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        badgeStyles[status],
      )}
    >
      {badgeLabel[status]}
      {status === 'verified' ? <Confetti /> : null}
    </span>
  );
}

function Confetti() {
  const bits = Array.from({ length: 8 });
  return (
    <span className="pointer-events-none absolute inset-0">
      {bits.map((_, i) => {
        const angle = (i / bits.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className={cn(
              'absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full',
              i % 2 ? 'bg-gold' : 'bg-success',
            )}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * 28,
              y: Math.sin(angle) * 18,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
          />
        );
      })}
    </span>
  );
}
