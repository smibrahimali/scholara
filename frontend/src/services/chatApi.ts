import { api } from './api';

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  contextStudentId?: string | null;
}

function contextParams(studentId?: string) {
  return studentId ? { studentId } : undefined;
}

export async function fetchChatMessages(studentId?: string) {
  const { data } = await api.get<ChatMessageDto[]>('/chat/messages', {
    params: contextParams(studentId),
  });
  return data;
}

export async function sendChatMessage(
  content: string,
  studentId?: string,
  options?: { signal?: AbortSignal },
) {
  const { data } = await api.post<{
    userMessage: ChatMessageDto;
    assistantMessage: ChatMessageDto;
  }>(
    '/chat/messages',
    { content, studentId },
    { timeout: 45_000, signal: options?.signal },
  );
  return data;
}

export async function clearChatMessages(studentId?: string) {
  const { data } = await api.delete<{ deleted: number }>('/chat/messages', {
    params: contextParams(studentId),
  });
  return data;
}
