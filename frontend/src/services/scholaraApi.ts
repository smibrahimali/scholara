import { api } from './api';
import type {
  ApplicationItem,
  ConsultantStudent,
  DashboardData,
  DocumentItem,
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

export async function fetchApplications(studentId?: string) {
  const { data } = await api.get<ApplicationItem[]>('/applications', {
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
  status: string,
  notes?: string,
) {
  const { data } = await api.patch<ApplicationItem>(
    `/applications/${applicationId}/steps/${stepNumber}`,
    { status, notes },
  );
  return data;
}

export async function fetchConsultantStudents() {
  const { data } = await api.get<ConsultantStudent[]>('/consultant/students');
  return data;
}
