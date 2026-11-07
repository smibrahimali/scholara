export type DocumentStatus =
  | 'NOT_UPLOADED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

export type ApplicationStatus =
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'ACCEPTED'
  | 'WAITLISTED'
  | 'REJECTED';

export type ApplicationStepStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED';

export interface DocumentItem {
  id: string;
  title: string;
  documentType: string;
  status: DocumentStatus;
  rejectionReason: string | null;
  storagePath?: string | null;
  hasFile?: boolean;
  updatedAt: string;
  reviews?: Array<{
    id: string;
    decision: string;
    reason: string | null;
    createdAt: string;
    reviewer?: { fullName: string };
  }>;
}

export interface ApplicationStep {
  id: string;
  stepNumber: number;
  label: string;
  status: ApplicationStepStatus;
  notes: string | null;
  completedAt: string | null;
}

export interface UniversityEmail {
  id: string;
  subject: string;
  sender: string;
  sentAt: string;
  body: string;
}

export interface EmailLogItem {
  id: string;
  subject: string;
  sender: string;
  sentAt: string;
  body: string;
  applicationId: string;
  universityName: string;
  programName: string;
  applicationStatus: ApplicationStatus;
}

export interface ApplicationItem {
  id: string;
  status: ApplicationStatus;
  decisionNotes: string | null;
  feeAmount: string | null;
  feeCurrency: string | null;
  feeDueDate: string | null;
  meritListDate: string | null;
  entryScore: string | null;
  university: { id: string; name: string; city?: string };
  program: { id: string; name: string };
  steps?: ApplicationStep[];
  emails?: UniversityEmail[];
  student?: {
    id: string;
    user: { fullName: string };
    consultant?: { user: { fullName: string }; title?: string } | null;
  };
}

export interface DashboardData {
  student: {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    targetProgram?: string;
    consultant: { id: string; fullName: string; title?: string } | null;
  };
  counts: {
    pendingDocuments: number;
    verifiedDocuments: number;
    rejectedDocuments: number;
    activeApplications: number;
  };
  documents: DocumentItem[];
  applications: ApplicationItem[];
  deadlines: Array<{
    label: string;
    date: string;
    university: string;
    applicationId: string;
  }>;
  recentCallNotes: Array<{
    id: string;
    summary: string;
    actionItems: string;
    universitiesDiscussed: string;
    followUps: string;
    createdAt: string;
  }>;
  readOnly: boolean;
}

export interface ConsultantStudent {
  id: string;
  fullName: string;
  email: string;
  targetProgram?: string;
  pendingReviews: number;
  rejectedDocuments: number;
  applications: number;
}

export interface CallNoteItem {
  id: string;
  callSessionId: string;
  summary: string;
  actionItems: string;
  universitiesDiscussed: string;
  followUps: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallSessionItem {
  id: string;
  studentId: string;
  consultantId: string;
  startedAt: string;
  endedAt: string | null;
  transcript: string | null;
  note?: CallNoteItem | null;
  consultant?: {
    id: string;
    title?: string;
    user: { fullName: string; email: string };
  };
  student?: {
    id: string;
    user: { fullName: string; email: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConsultantPeer {
  id: string;
  fullName: string;
  email: string;
  title: string | null;
}

export interface HandoverResult {
  studentId: string;
  studentName: string;
  fromConsultantId: string;
  toConsultant: { id: string; fullName: string; email: string };
  closedOpenCalls: number;
  inherited: {
    callSessions: number;
    documents: number;
    applications: number;
  };
  message: string;
}
