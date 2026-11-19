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

export enum CallRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  PAID = 'PAID',
  UPCOMING = 'UPCOMING',
}

export enum PaymentCategory {
  CONSULTANT = 'CONSULTANT',
  UNIVERSITY = 'UNIVERSITY',
  APPLICATION = 'APPLICATION',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}

/**
 * Student-facing email log is consultant → student only.
 * University mail is handled by the consultant and conveyed here.
 */
export enum EmailDirection {
  /** Consultant message to the student (visible in Email log). */
  TO_STUDENT = 'TO_STUDENT',
}
