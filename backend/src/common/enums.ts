export enum UserRole {
  STUDENT = 'STUDENT',
  GUARDIAN = 'GUARDIAN',
  CONSULTANT = 'CONSULTANT',
}

export enum DocumentStatus {
  NOT_UPLOADED = 'NOT_UPLOADED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum DocumentReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ApplicationStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  WAITLISTED = 'WAITLISTED',
  REJECTED = 'REJECTED',
}

export enum ApplicationStepStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}
