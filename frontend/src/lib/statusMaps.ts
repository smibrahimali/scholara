import type {
  ApplicationStatus,
  ApplicationStepStatus,
  DocumentStatus,
} from '../types/domain';

export type DocumentCardStatus =
  | 'Not uploaded'
  | 'Under review'
  | 'Verified'
  | 'Rejected';

export type DecisionStatus =
  | 'Accepted'
  | 'Rejected'
  | 'Waitlisted'
  | 'Pending';

export type TimelineStepStatus = 'Done' | 'Current' | 'Upcoming' | 'Skipped';

export function toDocumentCardStatus(
  status: DocumentStatus,
): DocumentCardStatus {
  switch (status) {
    case 'NOT_UPLOADED':
      return 'Not uploaded';
    case 'UNDER_REVIEW':
      return 'Under review';
    case 'VERIFIED':
      return 'Verified';
    case 'REJECTED':
      return 'Rejected';
    default:
      return 'Not uploaded';
  }
}

export function toDecisionStatus(status: ApplicationStatus): DecisionStatus {
  switch (status) {
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Rejected';
    case 'WAITLISTED':
      return 'Waitlisted';
    case 'PENDING':
    case 'IN_PROGRESS':
    default:
      return 'Pending';
  }
}

export function toTimelineStatus(
  status: ApplicationStepStatus,
): TimelineStepStatus {
  switch (status) {
    case 'COMPLETED':
      return 'Done';
    case 'IN_PROGRESS':
      return 'Current';
    case 'SKIPPED':
      return 'Skipped';
    case 'NOT_STARTED':
    default:
      return 'Upcoming';
  }
}

export function formatDisplayDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
