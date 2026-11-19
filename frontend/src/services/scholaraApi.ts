import { api } from './api';
import type {
  ApplicationItem,
  CallRequestItem,
  CallSessionItem,
  ConsultantPeer,
  ConsultantStudent,
  DashboardData,
  DocumentItem,
  EmailLogItem,
  HandoverResult,
  PaymentsSummary,
} from '../types/domain';

export async function fetchDashboard(studentId?: string) {
  const { data } = await api.get<DashboardData>('/students/dashboard', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function fetchDocuments(studentId?: string) {
  const { data } = await api.get<DocumentItem[]>('/documents', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function reviewDocument(
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
) {
  const { data } = await api.post<DocumentItem>(`/documents/${id}/review`, {
    decision,
    reason,
  });
  return data;
}

export async function uploadDocument(
  id: string,
  file: File,
  options?: { signal?: AbortSignal },
) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<DocumentItem>(`/documents/${id}/upload`, form, {
    // Do not set Content-Type manually — browser must include the multipart boundary.
    timeout: 60_000,
    signal: options?.signal,
  });
  return data;
}

export async function fetchDocumentDownloadUrl(id: string) {
  const { data } = await api.get<{ url: string; expiresInSeconds: number }>(
    `/documents/${id}/download-url`,
  );
  return data;
}

export async function fetchApplications(studentId?: string) {
  const { data } = await api.get<ApplicationItem[]>('/applications', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function fetchEmailLog(studentId?: string) {
  const { data } = await api.get<EmailLogItem[]>('/emails', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function replyToConsultantEmail(emailId: string, body: string) {
  const { data } = await api.post<EmailLogItem>(`/emails/${emailId}/reply`, {
    body,
  });
  return data;
}

export async function fetchPayments(studentId?: string) {
  const { data } = await api.get<PaymentsSummary>('/payments', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function fetchApplication(id: string) {
  const { data } = await api.get<ApplicationItem>(`/applications/${id}`);
  return data;
}

export async function updateApplicationStep(
  applicationId: string,
  stepNumber: number,
  payload: { status?: string; notes?: string },
) {
  const { data } = await api.patch<ApplicationItem>(
    `/applications/${applicationId}/steps/${stepNumber}`,
    payload,
  );
  return data;
}

export async function fetchConsultantStudents() {
  const { data } = await api.get<ConsultantStudent[]>('/consultant/students');
  return data;
}

export async function fetchCalls(studentId?: string) {
  const { data } = await api.get<CallSessionItem[]>('/calls', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function fetchCall(id: string) {
  const { data } = await api.get<CallSessionItem>(`/calls/${id}`);
  return data;
}

export async function startCall(callRequestId: string) {
  const { data } = await api.post<CallSessionItem>('/calls', {
    callRequestId,
  });
  return data;
}

export async function fetchCallRequests(params?: {
  studentId?: string;
  status?: string;
}) {
  const { data } = await api.get<CallRequestItem[]>('/call-requests', {
    params,
  });
  return data;
}

export async function createCallRequest(scheduledFor: string, note?: string) {
  const { data } = await api.post<CallRequestItem>('/call-requests', {
    scheduledFor,
    note,
  });
  return data;
}

export async function cancelCallRequest(id: string) {
  const { data } = await api.post<CallRequestItem>(
    `/call-requests/${id}/cancel`,
  );
  return data;
}

export async function approveCallRequest(id: string) {
  const { data } = await api.post<CallRequestItem>(
    `/call-requests/${id}/approve`,
  );
  return data;
}

export async function rejectCallRequest(id: string, reason?: string) {
  const { data } = await api.post<CallRequestItem>(
    `/call-requests/${id}/reject`,
    { reason },
  );
  return data;
}

export async function updateCallTranscript(
  id: string,
  transcript: string,
  append = false,
) {
  const { data } = await api.patch<CallSessionItem>(`/calls/${id}/transcript`, {
    transcript,
    append,
  });
  return data;
}

export async function appendLiveTranscriptLine(id: string, text: string) {
  const { data } = await api.post<CallSessionItem>(`/calls/${id}/live-line`, {
    text,
  });
  return data;
}

export async function transcribeCallAudio(
  id: string,
  blob: Blob,
  options?: { signal?: AbortSignal },
) {
  const form = new FormData();
  form.append('file', blob, `chunk-${Date.now()}.webm`);
  const { data } = await api.post<CallSessionItem>(
    `/calls/${id}/transcribe`,
    form,
    {
      // Let Axios set multipart boundary; Whisper can take longer than default.
      timeout: 45_000,
      signal: options?.signal,
    },
  );
  return data;
}

export async function endCall(id: string) {
  const { data } = await api.post<CallSessionItem>(`/calls/${id}/end`);
  return data;
}

export async function upsertCallNote(
  id: string,
  note: {
    summary: string;
    actionItems: string;
    universitiesDiscussed: string;
    followUps: string;
  },
) {
  const { data } = await api.put<CallSessionItem>(`/calls/${id}/note`, note);
  return data;
}

export async function fetchConsultantPeers() {
  const { data } = await api.get<ConsultantPeer[]>('/consultant/peers');
  return data;
}

export async function handoverStudent(
  studentId: string,
  toConsultantId: string,
) {
  const { data } = await api.post<HandoverResult>('/consultant/handover', {
    studentId,
    toConsultantId,
  });
  return data;
}
