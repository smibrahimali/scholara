import { api } from './api';

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export async function fetchChatMessages() {
  const { data } = await api.get<ChatMessageDto[]>('/chat/messages');
  return data;
}

export async function sendChatMessage(content: string, studentId?: string) {
  const { data } = await api.post<{
    userMessage: ChatMessageDto;
    assistantMessage: ChatMessageDto;
  }>('/chat/messages', { content, studentId });
  return data;
}

export async function clearChatMessages() {
  const { data } = await api.delete<{ deleted: number }>('/chat/messages');
  return data;
}
