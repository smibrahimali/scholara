export type UserRole = 'STUDENT' | 'GUARDIAN' | 'CONSULTANT';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentProfileId: string | null;
  guardianProfileId: string | null;
  consultantProfileId: string | null;
  linkedStudentId: string | null;
}

export interface DemoLoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface DemoAccount {
  email: string;
  role: UserRole;
  fullName: string;
  passwordHint: string;
}
