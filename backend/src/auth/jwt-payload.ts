import { UserRole } from '../common/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  fullName: string;
  studentProfileId?: string;
  guardianProfileId?: string;
  consultantProfileId?: string;
  linkedStudentId?: string;
}
