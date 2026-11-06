const COLORS: Record<string, string> = {
  VERIFIED: 'badge-ok',
  APPROVED: 'badge-ok',
  ACCEPTED: 'badge-ok',
  COMPLETED: 'badge-ok',
  UNDER_REVIEW: 'badge-warn',
  PENDING: 'badge-warn',
  IN_PROGRESS: 'badge-warn',
  WAITLISTED: 'badge-warn',
  REJECTED: 'badge-bad',
  NOT_UPLOADED: 'badge-muted',
  NOT_STARTED: 'badge-muted',
  SKIPPED: 'badge-muted',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = COLORS[status] ?? 'badge-muted';
  return <span className={`badge ${cls}`}>{status.replaceAll('_', ' ')}</span>;
}
