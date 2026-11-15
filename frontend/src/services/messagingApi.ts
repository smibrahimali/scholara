import { api } from './api';
import type {
  ChatRequestItem,
  ChatSessionItem,
  ConversationItem,
  DirectMessageItem,
} from '../types/domain';

export async function fetchConversations() {
  const { data } = await api.get<ConversationItem[]>('/messaging/conversations');
  return data;
}

export async function fetchOrCreateConversation(studentId?: string) {
  const { data } = await api.get<ConversationItem>('/messaging/conversation', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function fetchConversationMessages(
  conversationId: string,
  limit = 80,
) {
  const { data } = await api.get<DirectMessageItem[]>(
    `/messaging/conversation/${conversationId}/messages`,
    { params: { limit } },
  );
  return data;
}

export async function sendDirectMessage(conversationId: string, body: string) {
  const { data } = await api.post<DirectMessageItem>(
    `/messaging/conversation/${conversationId}/messages`,
    { body },
  );
  return data;
}

export async function markConversationRead(conversationId: string) {
  const { data } = await api.post<{ ok: boolean }>(
    `/messaging/conversation/${conversationId}/read`,
  );
  return data;
}

export async function fetchOpenChatSession(studentId?: string) {
  const { data } = await api.get<ChatSessionItem | null>(
    '/messaging/sessions/open',
    { params: studentId ? { studentId } : undefined },
  );
  return data;
}

export async function startChatSession(chatRequestId: string) {
  const { data } = await api.post<ChatSessionItem>('/messaging/sessions', {
    chatRequestId,
  });
  return data;
}

export async function endChatSession(sessionId: string) {
  const { data } = await api.post<ChatSessionItem>(
    `/messaging/sessions/${sessionId}/end`,
  );
  return data;
}

export async function fetchChatRequests(params?: {
  studentId?: string;
  status?: string;
}) {
  const { data } = await api.get<ChatRequestItem[]>('/chat-requests', {
    params,
  });
  return data;
}

export async function createChatRequest(scheduledFor: string, note?: string) {
  const { data } = await api.post<ChatRequestItem>('/chat-requests', {
    scheduledFor,
    note,
  });
  return data;
}

export async function cancelChatRequest(id: string) {
  const { data } = await api.post<ChatRequestItem>(
    `/chat-requests/${id}/cancel`,
  );
  return data;
}

export async function approveChatRequest(id: string) {
  const { data } = await api.post<ChatRequestItem>(
    `/chat-requests/${id}/approve`,
  );
  return data;
}

export async function rejectChatRequest(id: string, reason?: string) {
  const { data } = await api.post<ChatRequestItem>(
    `/chat-requests/${id}/reject`,
    { reason },
  );
  return data;
}
