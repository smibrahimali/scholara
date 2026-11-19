import { cn } from '../../lib/cn';
import { semanticSurface } from '../../lib/semanticStatus';
import type { DocumentStatus } from '../../types/domain';

export type DocStatus = 'verified' | 'review' | 'rejected' | 'pending';

const badgeStyles: Record<DocStatus, string> = {
  verified: semanticSurface.success,
  review: semanticSurface.warning,
  rejected: semanticSurface.danger,
  pending: semanticSurface.neutral,
};

/** Single consistent document status vocabulary across the app. */
const badgeLabel: Record<DocStatus, string> = {
  verified: 'Approved',
  review: 'Waiting for review',
  rejected: 'Needs re-upload',
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
        'relative inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        badgeStyles[status],
      )}
      role="status"
    >
      {badgeLabel[status]}
    </span>
  );
}
