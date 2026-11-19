/** Shared TanStack Query keys so screens reuse the same cache entries. */

export function dashboardKey(studentScope: string | undefined) {
  return ['dashboard', studentScope ?? 'self'] as const;
}

export function paymentsKey(studentScope: string | undefined) {
  return ['payments', studentScope ?? 'self'] as const;
}

export function callsKey(studentScope: string | undefined) {
  return ['calls', studentScope ?? 'self'] as const;
}

export function callRequestsKey(
  studentScope: string | undefined,
  status?: string,
) {
  return status
    ? (['call-requests', studentScope ?? 'self', status] as const)
    : (['call-requests', studentScope ?? 'self'] as const);
}

/** Consultant desk pending queue (no student filter). */
export const consultantPendingCallRequestsKey = [
  'call-requests',
  'all',
  'PENDING',
] as const;

export function documentsKey(studentScope: string | undefined) {
  return ['documents', studentScope ?? 'self'] as const;
}

export function applicationsKey(studentScope: string | undefined) {
  return ['applications', studentScope ?? 'self'] as const;
}

export function applicationKey(id: string | undefined) {
  return ['application', id] as const;
}

export function emailsKey(studentScope: string | undefined) {
  return ['emails', studentScope ?? 'self'] as const;
}

export function callKey(callId: string | undefined) {
  return ['call', callId] as const;
}

export const chatMessagesKey = ['chat-messages'] as const;
export const consultantStudentsKey = ['consultant-students'] as const;
export const consultantPeersKey = ['consultant-peers'] as const;
