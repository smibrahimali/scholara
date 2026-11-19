import type {
  CallRequestItem,
  DashboardData,
  PaymentItem,
  PaymentsSummary,
} from '../types/domain';

export type AttentionTone = 'danger' | 'warning' | 'navy' | 'success' | 'info';

/** Home strip = tasks; bell inbox = communication. */
export type AttentionChannel = 'task' | 'comms';

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  cta: string;
  href: string;
  tone: AttentionTone;
  channel: AttentionChannel;
  /** Lower = higher priority */
  priority: number;
};

function daysUntil(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function finalize(items: AttentionItem[], limit = 8): AttentionItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

type BuildAttentionArgs = {
  data: DashboardData;
  paths: {
    docs: string;
    apps: string;
    calls: string;
    messages: string;
    payments: string;
    liveCall?: (id: string) => string;
  };
  openLiveCallId?: string | null;
  pendingCallRequests?: CallRequestItem[];
  payments?: PaymentsSummary | null;
  role: 'STUDENT' | 'GUARDIAN' | 'CONSULTANT';
};

/**
 * Builds attention items from existing dashboard data.
 * - `task` → Home "Needs attention" (docs, fees, deadlines)
 * - `comms` → Bell inbox (live call, call requests, notes)
 */
export function buildAttentionItems({
  data,
  paths,
  openLiveCallId,
  pendingCallRequests = [],
  payments,
  role,
}: BuildAttentionArgs): AttentionItem[] {
  const items: AttentionItem[] = [];
  const isConsultant = role === 'CONSULTANT';
  const isGuardian = role === 'GUARDIAN';
  const documents = data.documents ?? [];
  const deadlines = data.deadlines ?? [];
  const recentCallNotes = data.recentCallNotes ?? [];

  // —— Communication (bell) ——
  if (openLiveCallId) {
    items.push({
      id: `live-${openLiveCallId}`,
      title: 'Live call in progress',
      detail: isConsultant
        ? 'A consultation room is open for this student.'
        : 'Join to speak with your consultant — transcription runs automatically.',
      cta: isConsultant ? 'Open live call' : 'Join live call',
      href: paths.liveCall?.(openLiveCallId) ?? `/app/live-call/${openLiveCallId}`,
      tone: 'success',
      channel: 'comms',
      priority: 0,
    });
  }

  for (const req of pendingCallRequests) {
    if (req.status !== 'PENDING') continue;
    items.push({
      id: `call-req-${req.id}`,
      title: isConsultant
        ? `Call request from ${req.studentName ?? 'student'}`
        : 'Call request awaiting approval',
      detail: `Requested for ${new Date(req.scheduledFor).toLocaleString(
        undefined,
        {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        },
      )}.`,
      cta: isConsultant ? 'Review request' : 'View request',
      href: paths.calls,
      tone: 'warning',
      channel: 'comms',
      priority: 2,
    });
  }

  for (const note of recentCallNotes.slice(0, 3)) {
    items.push({
      id: `note-${note.id}`,
      title: 'New consultation note',
      detail:
        note.summary || note.followUps || 'Review the latest call summary.',
      cta: 'View calls',
      href: paths.calls,
      tone: 'info',
      channel: 'comms',
      priority: 5,
    });
  }

  // —— Tasks (Home) ——
  for (const doc of documents) {
    if (doc.status === 'REJECTED') {
      items.push({
        id: `rej-${doc.id}`,
        title: `${doc.title} was rejected`,
        detail: isConsultant
          ? (doc.rejectionReason ??
            'The student needs to re-upload a corrected file.')
          : isGuardian
            ? (doc.rejectionReason ??
              'Waiting on the student to re-upload a corrected file.')
            : (doc.rejectionReason ??
              'Please re-upload a corrected file to keep your application moving.'),
        cta: isConsultant || isGuardian ? 'Review documents' : 'Re-upload',
        href: paths.docs,
        tone: 'danger',
        channel: 'task',
        priority: 2,
      });
    } else if (doc.status === 'NOT_UPLOADED') {
      items.push({
        id: `miss-${doc.id}`,
        title: `${doc.title} still needed`,
        detail: isConsultant
          ? 'Waiting on the student to upload this document.'
          : isGuardian
            ? 'Waiting on the student to upload this document.'
            : 'Upload this document to keep your application moving.',
        cta: isConsultant || isGuardian ? 'View documents' : 'Upload',
        href: paths.docs,
        tone: 'warning',
        channel: 'task',
        priority: 3,
      });
    } else if (doc.status === 'UNDER_REVIEW' && isConsultant) {
      items.push({
        id: `rev-${doc.id}`,
        title: `${doc.title} ready to review`,
        detail: 'Approve or reject this document for the student.',
        cta: 'Review document',
        href: paths.docs,
        tone: 'warning',
        channel: 'task',
        priority: 4,
      });
    }
  }

  for (const d of deadlines) {
    const left = daysUntil(d.date);
    if (left == null || left > 14) continue;
    items.push({
      id: `due-${d.applicationId}-${d.label}`,
      title:
        left < 0
          ? `Deadline passed · ${d.university}`
          : left === 0
            ? `Due today · ${d.university}`
            : `${d.label} in ${left} days`,
      detail: `${d.label} · ${d.university}`,
      cta: 'View application',
      href: paths.apps,
      tone: left < 0 || left <= 3 ? 'danger' : 'warning',
      channel: 'task',
      priority: left < 0 ? 2 : left <= 3 ? 6 : 8,
    });
  }

  const upcomingPayments: PaymentItem[] = payments?.upcoming ?? [];
  for (const pay of upcomingPayments.slice(0, 2)) {
    const left = daysUntil(pay.occurredOn);
    if (left != null && left > 14) continue;
    items.push({
      id: `pay-${pay.id}`,
      title: left != null && left < 0 ? `Overdue · ${pay.title}` : pay.title,
      detail: pay.payeeLabel
        ? `${pay.payeeLabel} · payment due`
        : 'Upcoming fee — review in Fees & payments.',
      cta: 'View fees',
      href: paths.payments,
      tone: left != null && left < 0 ? 'danger' : 'warning',
      channel: 'task',
      priority: left != null && left < 0 ? 2 : 7,
    });
  }

  return finalize(items);
}

export function filterAttentionByChannel(
  items: AttentionItem[],
  channel: AttentionChannel,
): AttentionItem[] {
  return items.filter((item) => item.channel === channel);
}
