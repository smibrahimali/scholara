import type { ApplicationStatus, DocumentStatus } from '../types/domain';

/** Shared semantic surface classes (bg + text) for chips and tones. */
export const semanticSurface = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
  navy: 'bg-primary text-gold',
} as const;

export type SemanticTone = keyof typeof semanticSurface;

export function documentSemanticTone(
  status: DocumentStatus,
): Exclude<SemanticTone, 'navy'> {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function applicationSemanticTone(
  status: ApplicationStatus,
): Exclude<SemanticTone, 'navy'> {
  switch (status) {
    case 'ACCEPTED':
      return 'success';
    case 'WAITLISTED':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    case 'PENDING':
    case 'IN_PROGRESS':
    default:
      return 'neutral';
  }
}
