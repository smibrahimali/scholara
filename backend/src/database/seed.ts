import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import {
  ApplicationStatus,
  ApplicationStepStatus,
  CallRequestStatus,
  DocumentReviewDecision,
  DocumentStatus,
  UserRole,
} from '../common/enums';
import { entities } from './database.module';
import { postgresSslOption } from './postgres-ssl';
import { User } from '../users/user.entity';
import { StudentProfile } from '../students/student-profile.entity';
import { GuardianProfile } from '../guardians/guardian-profile.entity';
import { ConsultantProfile } from '../consultants/consultant-profile.entity';
import { University } from '../universities/university.entity';
import { Program } from '../programs/program.entity';
import { Application } from '../applications/application.entity';
import {
  APPLICATION_STEP_LABELS,
  ApplicationStep,
} from '../applications/application-step.entity';
import { Document } from '../documents/document.entity';
import { DocumentReview } from '../documents/document-review.entity';
import { UniversityEmail } from '../emails/university-email.entity';
import { CallSession } from '../calls/call-session.entity';
import { CallNote } from '../calls/call-note.entity';
import { CallRequest } from '../calls/call-request.entity';
import { Conversation } from '../messaging/conversation.entity';
import { DirectMessage } from '../messaging/direct-message.entity';
import { ChatSession } from '../messaging/chat-session.entity';
import { ChatRequest } from '../messaging/chat-request.entity';
import { ChatMessage } from '../chat/chat-message.entity';

const DEFAULT_STEP_NOTES: Record<number, string> = {
  1: 'Programme and intake requirements reviewed with the student before registration.',
  2: 'Student profile and contact details have been checked against the submitted identity information.',
  3: 'Preferred programme selected after comparing entry requirements, tuition, and deadlines.',
  4: 'Application form submitted and acknowledgement received from the university admissions office.',
  5: 'Application fee status recorded; retain the receipt for the admissions finance review.',
  6: 'Admissions team is checking academic records, identity documents, and eligibility requirements.',
  7: 'Entry test or interview preparation and completion status will be recorded when scheduled.',
  8: 'Merit calculation will combine the academic profile, entry result, and programme capacity.',
  9: 'Admissions decision will be recorded after the merit and document reviews are complete.',
  10: 'Offer letter or fee challan will be issued once the admission decision is confirmed.',
  11: 'Fee payment confirmation must be matched to the student account before enrollment can proceed.',
  12: 'Enrollment is completed after the university confirms payment and registration documents.',
};

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env') });

async function createSteps(
  dataSource: DataSource,
  applicationId: string,
  completedThrough: number,
  skipped: number[] = [],
  notes: Record<number, string> = {},
  timelineStart = new Date('2026-09-28T09:00:00.000Z'),
) {
  const stepRepo = dataSource.getRepository(ApplicationStep);
  for (let n = 1; n <= 12; n += 1) {
    let status = ApplicationStepStatus.NOT_STARTED;
    let completedAt: Date | null = null;
    if (skipped.includes(n)) {
      status = ApplicationStepStatus.SKIPPED;
    } else if (n < completedThrough) {
      status = ApplicationStepStatus.COMPLETED;
      completedAt = new Date(timelineStart);
      completedAt.setUTCDate(completedAt.getUTCDate() + (n - 1) * 3);
    } else if (n === completedThrough) {
      status = ApplicationStepStatus.IN_PROGRESS;
    }

    await stepRepo.save(
      stepRepo.create({
        applicationId,
        stepNumber: n,
        label: APPLICATION_STEP_LABELS[n],
        status,
        notes:
          status === ApplicationStepStatus.NOT_STARTED
            ? null
            : (notes[n] ?? DEFAULT_STEP_NOTES[n] ?? null),
        completedAt,
      }),
    );
  }
}

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities,
    synchronize: true,
    ssl: postgresSslOption(databaseUrl),
  });

  await dataSource.initialize();
  console.log('Connected. Clearing and seeding demo data...');

  // Clear in FK-safe order
  await dataSource
    .getRepository(DirectMessage)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(ChatRequest)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(ChatSession)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(Conversation)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(ChatMessage)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(CallRequest)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(CallNote)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(CallSession)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(DocumentReview)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(Document)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(UniversityEmail)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(ApplicationStep)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(Application)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(Program)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(University)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(GuardianProfile)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(StudentProfile)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(ConsultantProfile)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource.getRepository(User).createQueryBuilder().delete().execute();

  const passwordHash = await bcrypt.hash('demo123', 10);
  const userRepo = dataSource.getRepository(User);

  const studentUser = await userRepo.save(
    userRepo.create({
      email: 'student@scholara.demo',
      passwordHash,
      fullName: 'Ali Raza',
      role: UserRole.STUDENT,
    }),
  );
  const guardianUser = await userRepo.save(
    userRepo.create({
      email: 'guardian@scholara.demo',
      passwordHash,
      fullName: 'Fatima Raza',
      role: UserRole.GUARDIAN,
    }),
  );
  const consultant1User = await userRepo.save(
    userRepo.create({
      email: 'consultant1@scholara.demo',
      passwordHash,
      fullName: 'Sara Ahmed',
      role: UserRole.CONSULTANT,
    }),
  );
  const consultant2User = await userRepo.save(
    userRepo.create({
      email: 'consultant2@scholara.demo',
      passwordHash,
      fullName: 'Bilal Khan',
      role: UserRole.CONSULTANT,
    }),
  );

  const consultantRepo = dataSource.getRepository(ConsultantProfile);
  const consultant1 = await consultantRepo.save(
    consultantRepo.create({
      userId: consultant1User.id,
      title: 'Senior Admission Consultant',
    }),
  );
  const consultant2 = await consultantRepo.save(
    consultantRepo.create({
      userId: consultant2User.id,
      title: 'Admission Consultant',
    }),
  );

  const studentRepo = dataSource.getRepository(StudentProfile);
  const student = await studentRepo.save(
    studentRepo.create({
      userId: studentUser.id,
      consultantId: consultant1.id,
      phone: '+92-300-1234567',
      targetProgram: 'BS Computer Science',
    }),
  );

  const guardianRepo = dataSource.getRepository(GuardianProfile);
  await guardianRepo.save(
    guardianRepo.create({
      userId: guardianUser.id,
      linkedStudentId: student.id,
    }),
  );

  const universityRepo = dataSource.getRepository(University);
  const pstu = await universityRepo.save(
    universityRepo.create({
      name: 'Qatar University',
      city: 'Doha',
      country: 'Qatar',
    }),
  );
  const ivu = await universityRepo.save(
    universityRepo.create({
      name: 'American University of Sharjah',
      city: 'Sharjah',
      country: 'UAE',
    }),
  );
  const kit = await universityRepo.save(
    universityRepo.create({
      name: 'Khalifa University',
      city: 'Abu Dhabi',
      country: 'UAE',
    }),
  );

  const programRepo = dataSource.getRepository(Program);
  const pstuCs = await programRepo.save(
    programRepo.create({
      universityId: pstu.id,
      name: 'BS Computer Science',
      degreeLevel: 'Undergraduate',
    }),
  );
  const ivuSe = await programRepo.save(
    programRepo.create({
      universityId: ivu.id,
      name: 'BS Software Engineering',
      degreeLevel: 'Undergraduate',
    }),
  );
  const kitCs = await programRepo.save(
    programRepo.create({
      universityId: kit.id,
      name: 'BS Computer Science',
      degreeLevel: 'Undergraduate',
    }),
  );

  const applicationRepo = dataSource.getRepository(Application);
  const pstuApp = await applicationRepo.save(
    applicationRepo.create({
      studentId: student.id,
      universityId: pstu.id,
      programId: pstuCs.id,
      status: ApplicationStatus.PENDING,
      intakeYear: 2027,
      intakeTerm: 'Fall',
      submittedAt: new Date('2026-10-14T09:20:00.000Z'),
      createdAt: new Date('2026-10-14T09:20:00.000Z'),
      updatedAt: new Date('2026-11-17T10:30:00.000Z'),
      decisionNotes:
        'Initial verification is underway. Admissions is waiting for a clearer transcript scan before confirming the entry-test timeline.',
    }),
  );
  const ivuApp = await applicationRepo.save(
    applicationRepo.create({
      studentId: student.id,
      universityId: ivu.id,
      programId: ivuSe.id,
      status: ApplicationStatus.WAITLISTED,
      intakeYear: 2027,
      intakeTerm: 'Fall',
      submittedAt: new Date('2026-10-09T11:15:00.000Z'),
      decisionAt: new Date('2026-11-12T14:00:00.000Z'),
      entryScore: '71',
      meritListDate: '2026-11-12',
      createdAt: new Date('2026-10-09T11:15:00.000Z'),
      updatedAt: new Date('2026-11-12T14:00:00.000Z'),
      decisionNotes:
        'Student scored 71/100 in the entry assessment. The application remains waitlisted pending the final merit-list review.',
    }),
  );
  const kitApp = await applicationRepo.save(
    applicationRepo.create({
      studentId: student.id,
      universityId: kit.id,
      programId: kitCs.id,
      status: ApplicationStatus.ACCEPTED,
      intakeYear: 2027,
      intakeTerm: 'Spring',
      submittedAt: new Date('2026-09-28T08:45:00.000Z'),
      decisionAt: new Date('2026-11-05T12:00:00.000Z'),
      feePaidAt: null,
      enrollmentConfirmedAt: null,
      feeAmount: '45000',
      feeCurrency: 'AED',
      feeDueDate: '2026-11-15',
      createdAt: new Date('2026-09-28T08:45:00.000Z'),
      updatedAt: new Date('2026-11-15T16:20:00.000Z'),
      decisionNotes:
        'Offer accepted. Enrollment confirmation is blocked until the AED 45,000 fee payment is verified by the finance office.',
    }),
  );

  // completedThrough = first IN_PROGRESS step; all earlier steps COMPLETED
  // (strictly sequential — never COMPLETED after an unfinished/skipped gap).
  await createSteps(dataSource, pstuApp.id, 6, [], {
    5: 'Application fee receipt is uploaded. Initial verification is waiting for the corrected official transcript.',
    6: 'Consultant is reviewing the replacement transcript before confirming entry-test eligibility.',
  }, new Date('2026-10-14T09:20:00.000Z'));
  await createSteps(dataSource, ivuApp.id, 8, [], {
    7: 'Entry test completed with a score of 71/100.',
    8: 'Merit calculation is complete; final placement depends on the next waitlist release.',
  }, new Date('2026-10-09T11:15:00.000Z'));
  await createSteps(dataSource, kitApp.id, 9, [], {
    9: 'Admission offer received and accepted. Student is comparing the payment deadline with the remaining university options.',
  }, new Date('2026-09-28T08:45:00.000Z'));

  const documentRepo = dataSource.getRepository(Document);
  const reviewRepo = dataSource.getRepository(DocumentReview);

  const transcript = await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      title: 'Official Transcript',
      documentType: 'TRANSCRIPT',
      status: DocumentStatus.REJECTED,
      rejectionReason:
        'The uploaded transcript is blurred on pages 2 and 3 and the university seal is not legible. Please scan the original colour document in full and re-upload all pages as one PDF.',
      uploadedAt: new Date('2026-11-06T10:15:00.000Z'),
      lastReviewedAt: new Date('2026-11-07T09:30:00.000Z'),
      rejectedAt: new Date('2026-11-07T09:30:00.000Z'),
      storagePath: null,
    }),
  );
  await reviewRepo.save(
    reviewRepo.create({
      documentId: transcript.id,
      reviewerId: consultant1User.id,
      decision: DocumentReviewDecision.REJECTED,
      reason:
        'Rejected because the university seal and course grades cannot be verified from the scan. A complete, high-resolution colour scan is required.',
    }),
  );

  const cnic = await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      title: 'CNIC / B-Form',
      documentType: 'IDENTITY',
      status: DocumentStatus.VERIFIED,
      uploadedAt: new Date('2026-10-01T08:00:00.000Z'),
      lastReviewedAt: new Date('2026-10-02T13:00:00.000Z'),
      verifiedAt: new Date('2026-10-02T13:00:00.000Z'),
    }),
  );
  await reviewRepo.save(
    reviewRepo.create({
      documentId: cnic.id,
      reviewerId: consultant1User.id,
      decision: DocumentReviewDecision.APPROVED,
      reason: null,
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      title: 'Recommendation Letter',
      documentType: 'RECOMMENDATION',
      status: DocumentStatus.UNDER_REVIEW,
      uploadedAt: new Date('2026-11-16T12:10:00.000Z'),
      lastReviewedAt: new Date('2026-11-17T09:00:00.000Z'),
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      title: 'Passport Photo',
      documentType: 'PHOTO',
      status: DocumentStatus.NOT_UPLOADED,
    }),
  );

  const emailRepo = dataSource.getRepository(UniversityEmail);
  await emailRepo.save(
    emailRepo.create({
      applicationId: ivuApp.id,
      subject: 'Entry Test Result and Merit List Schedule',
      sender: 'admissions@aus.edu.demo',
      sentAt: new Date('2026-11-01T10:00:00.000Z'),
      body: 'Dear Ali Raza,\n\nYour entry test score is 71/100. The merit list will be published on 12 November.\n\nRegards,\nAmerican University of Sharjah Admissions',
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: kitApp.id,
      subject: 'Fee Invoice and Enrollment Deadline',
      sender: 'finance@ku.ac.ae.demo',
      sentAt: new Date('2026-11-03T09:00:00.000Z'),
      body: 'Dear Ali Raza,\n\nCongratulations on your admission offer. Your fee of AED 45,000 is due by 15 November 2026.\n\nRegards,\nKhalifa University Finance Office',
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: pstuApp.id,
      subject: 'Application Received',
      sender: 'admissions@qu.edu.qa.demo',
      sentAt: new Date('2026-10-20T08:30:00.000Z'),
      body: 'Dear Ali Raza,\n\nWe have received your application to BS Computer Science. Initial verification is in progress.\n\nRegards,\nQatar University Admissions',
    }),
  );

  const callRepo = dataSource.getRepository(CallSession);
  const noteRepo = dataSource.getRepository(CallNote);
  const call = await callRepo.save(
    callRepo.create({
      studentId: student.id,
      consultantId: consultant1.id,
      startedAt: new Date('2026-10-28T14:00:00.000Z'),
      endedAt: new Date('2026-10-28T14:25:00.000Z'),
      transcript:
        'Discussed Khalifa University fee deadline of 15 November 2026 and American University of Sharjah merit list on 12 November. Student will re-upload blurred transcript.',
    }),
  );
  await noteRepo.save(
    noteRepo.create({
      callSessionId: call.id,
      summary:
        'Reviewed the rejected transcript, Khalifa University fee deadline, and American University of Sharjah waitlist position. Student understands that the transcript must be corrected before final verification.',
      actionItems:
        '1) Re-upload a complete colour transcript scan.\n2) Confirm whether the AED 45,000 Khalifa University fee can be paid before 15 November.\n3) Monitor the American University of Sharjah merit-list update and notify the consultant immediately.',
      universitiesDiscussed:
        'Khalifa University, American University of Sharjah, Qatar University',
      followUps:
        'Consultant to review the replacement transcript within one business day and schedule a short follow-up before the Khalifa University payment deadline.',
    }),
  );

  // Keep consultant2 available for reassignment demos (no students yet)
  void consultant2;

  const callRequestRepo = dataSource.getRepository(CallRequest);
  await callRequestRepo.save(
    callRequestRepo.create({
      studentId: student.id,
      consultantId: consultant1.id,
      scheduledFor: new Date('2026-11-20T10:00:00.000Z'),
      status: CallRequestStatus.APPROVED,
      studentNote:
        'Want to review Khalifa University fee deadline and transcript re-upload.',
      consultantNote: null,
      callSessionId: null,
    }),
  );

  const conversationRepo = dataSource.getRepository(Conversation);
  const dmRepo = dataSource.getRepository(DirectMessage);
  const chatRequestRepo = dataSource.getRepository(ChatRequest);
  const chatSessionRepo = dataSource.getRepository(ChatSession);
  const conversation = await conversationRepo.save(
    conversationRepo.create({
      studentId: student.id,
      consultantId: consultant1.id,
    }),
  );
  const activeChatRequest = await chatRequestRepo.save(
    chatRequestRepo.create({
      studentId: student.id,
      consultantId: consultant1.id,
      scheduledFor: new Date('2026-11-17T15:30:00.000Z'),
      status: CallRequestStatus.APPROVED,
      studentNote:
        'I would like to discuss the rejected transcript, the KIT fee deadline, and whether I should keep my AUS waitlist application active.',
      consultantNote:
        'Reviewed the transcript rejection and advised the student to upload a colour scan. Consultant will confirm the KIT payment plan after the corrected document is received.',
      chatSessionId: null,
    }),
  );
  const activeChatSession = await chatSessionRepo.save(
    chatSessionRepo.create({
      studentId: student.id,
      consultantId: consultant1.id,
      conversationId: conversation.id,
      startedAt: new Date('2026-11-17T15:30:00.000Z'),
      endedAt: null,
    }),
  );
  activeChatRequest.chatSessionId = activeChatSession.id;
  await chatRequestRepo.save(activeChatRequest);
  await chatRequestRepo.save(
    chatRequestRepo.create({
      studentId: student.id,
      consultantId: consultant1.id,
      scheduledFor: new Date('2026-11-10T11:00:00.000Z'),
      status: CallRequestStatus.CANCELLED,
      studentNote:
        'Requested cancellation because the scheduled time conflicted with a university examination.',
      consultantNote:
        'Cancellation acknowledged. Student may submit a new request after confirming availability.',
      chatSessionId: null,
    }),
  );
  await dmRepo.save(
    dmRepo.create({
      conversationId: conversation.id,
      chatSessionId: activeChatSession.id,
      senderUserId: consultant1User.id,
      body: 'Hi Ali — please re-upload your transcript before the Khalifa University fee deadline. Happy to hop on a quick call if helpful.',
      readAt: null,
    }),
  );
  await dmRepo.save(
    dmRepo.create({
      conversationId: conversation.id,
      chatSessionId: activeChatSession.id,
      senderUserId: studentUser.id,
      body: 'Thanks Sara. I will upload a clearer scan today and confirm once it is under review.',
      readAt: null,
    }),
  );

  console.log('Seed complete.');
  console.log('Demo accounts (password: demo123):');
  console.log('  student@scholara.demo      — Ali Raza (STUDENT)');
  console.log('  guardian@scholara.demo     — Fatima Raza (GUARDIAN)');
  console.log('  consultant1@scholara.demo  — Sara Ahmed (CONSULTANT)');
  console.log('  consultant2@scholara.demo  — Bilal Khan (CONSULTANT)');

  await dataSource.destroy();
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
