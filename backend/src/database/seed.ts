import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource, EntityManager } from 'typeorm';
import {
  ApplicationStatus,
  ApplicationStepStatus,
  CallRequestStatus,
  DocumentReviewDecision,
  DocumentStatus,
  EmailDirection,
  PaymentCategory,
  PaymentStatus,
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
import { ApplicationStatusHistory } from '../applications/application-status-history.entity';
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
import { StudentPayment } from '../payments/student-payment.entity';

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
  manager: EntityManager,
  applicationId: string,
  completedThrough: number,
  skipped: number[] = [],
  notes: Record<number, string> = {},
  timelineStart = new Date('2026-09-28T09:00:00.000Z'),
) {
  const stepRepo = manager.getRepository(ApplicationStep);
  const steps: ApplicationStep[] = [];
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

    steps.push(
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
  await stepRepo.save(steps);
}

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed');
  }

  // Schema is owned by Nest/migrations — avoid synchronize races with a live backend.
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities,
    synchronize: false,
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
    .getRepository(StudentPayment)
    .createQueryBuilder()
    .delete()
    .execute();
  await dataSource
    .getRepository(ApplicationStatusHistory)
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

  // Persist applications + steps in one transaction so step FKs always see committed apps.
  const { pstuApp, ivuApp, kitApp } = await dataSource.transaction(
    async (manager) => {
      const applicationRepo = manager.getRepository(Application);
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
      await createSteps(
        manager,
        pstuApp.id,
        6,
        [],
        {
          5: 'Application fee payment receipt is uploaded. Initial verification is waiting for the corrected official academic transcript.',
          6: 'Consultant is reviewing the replacement academic transcript before confirming entrance-exam eligibility.',
        },
        new Date('2026-10-14T09:20:00.000Z'),
      );
      await createSteps(
        manager,
        ivuApp.id,
        8,
        [],
        {
          7: 'Entrance exam completed with a score of 71/100.',
          8: 'Merit calculation is complete; final placement depends on the next waitlist release.',
        },
        new Date('2026-10-09T11:15:00.000Z'),
      );
      await createSteps(
        manager,
        kitApp.id,
        9,
        [],
        {
          9: 'Admission offer received and accepted. Student is comparing the payment deadline with the remaining university options.',
        },
        new Date('2026-09-28T08:45:00.000Z'),
      );

      return { pstuApp, ivuApp, kitApp };
    },
  );

  // Demo payment ledger (USD) — realistic Gulf admissions history + upcoming.
  const paymentRepo = dataSource.getRepository(StudentPayment);
  await paymentRepo.save([
    paymentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Consultant intake session',
      description:
        'Initial 1:1 admissions coaching with Sara Ahmed — profile review and Gulf university shortlist',
      category: PaymentCategory.CONSULTANT,
      status: PaymentStatus.PAID,
      amount: '100.00',
      currency: 'USD',
      occurredOn: '2026-09-13',
      payeeLabel: 'Scholara Consultant Desk',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: pstuApp.id,
      title: 'Qatar University application fee',
      description:
        'Non-refundable BS Computer Science application processing fee',
      category: PaymentCategory.APPLICATION,
      status: PaymentStatus.PAID,
      amount: '50.00',
      currency: 'USD',
      occurredOn: '2026-09-22',
      payeeLabel: 'Qatar University Admissions',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: kitApp.id,
      title: 'Khalifa University application fee',
      description: 'Undergraduate application fee for BS Computer Science',
      category: PaymentCategory.APPLICATION,
      status: PaymentStatus.PAID,
      amount: '75.00',
      currency: 'USD',
      occurredOn: '2026-09-28',
      payeeLabel: 'Khalifa University Admissions',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: ivuApp.id,
      title: 'American University of Sharjah application fee',
      description: 'BS Software Engineering application processing fee',
      category: PaymentCategory.APPLICATION,
      status: PaymentStatus.PAID,
      amount: '120.00',
      currency: 'USD',
      occurredOn: '2026-10-05',
      payeeLabel: 'American University of Sharjah Admissions',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Document attestation',
      description:
        'Official transcript and civil ID attestation for UAE/Qatar submissions',
      category: PaymentCategory.DOCUMENT,
      status: PaymentStatus.PAID,
      amount: '95.00',
      currency: 'USD',
      occurredOn: '2026-10-18',
      payeeLabel: 'Gulf Attestation Desk',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: ivuApp.id,
      title: 'AUS entry-test registration',
      description:
        'Entrance assessment registration fee (score recorded: 71/100)',
      category: PaymentCategory.APPLICATION,
      status: PaymentStatus.PAID,
      amount: '40.00',
      currency: 'USD',
      occurredOn: '2026-10-25',
      payeeLabel: 'American University of Sharjah Exams Office',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: ivuApp.id,
      title: 'AUS waitlist seat / tuition hold',
      description:
        'Refundable tuition hold deposit while waitlisted pending merit-list release',
      category: PaymentCategory.UNIVERSITY,
      status: PaymentStatus.PAID,
      amount: '700.00',
      currency: 'USD',
      occurredOn: '2026-11-12',
      payeeLabel: 'American University of Sharjah Finance',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: kitApp.id,
      title: 'Khalifa University enrollment fee',
      description:
        'First-term enrollment / offer acceptance fee due before finance confirmation',
      category: PaymentCategory.UNIVERSITY,
      status: PaymentStatus.UPCOMING,
      amount: '12250.00',
      currency: 'USD',
      occurredOn: '2026-11-15',
      payeeLabel: 'Khalifa University Finance Office',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Consultant follow-up session',
      description:
        'Fee-plan review and transcript re-upload coaching with Sara Ahmed',
      category: PaymentCategory.CONSULTANT,
      status: PaymentStatus.UPCOMING,
      amount: '100.00',
      currency: 'USD',
      occurredOn: '2026-11-20',
      payeeLabel: 'Scholara Consultant Desk',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: kitApp.id,
      title: 'UAE student visa filing support',
      description:
        'Student visa paperwork assistance after Khalifa enrollment is confirmed',
      category: PaymentCategory.OTHER,
      status: PaymentStatus.UPCOMING,
      amount: '350.00',
      currency: 'USD',
      occurredOn: '2026-12-01',
      payeeLabel: 'Scholara Visa Desk',
    }),
    paymentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Medical fitness / Emirates ID support',
      description:
        'Medical fitness appointment coordination and Emirates ID support fee',
      category: PaymentCategory.OTHER,
      status: PaymentStatus.UPCOMING,
      amount: '25.00',
      currency: 'USD',
      occurredOn: '2026-12-05',
      payeeLabel: 'Scholara Visa Desk',
    }),
  ]);

  const documentRepo = dataSource.getRepository(Document);
  const reviewRepo = dataSource.getRepository(DocumentReview);

  // General documents (shared across all university applications)
  const transcript = await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Official Academic Transcript',
      documentType: 'TRANSCRIPT',
      status: DocumentStatus.REJECTED,
      rejectionReason:
        'The uploaded academic transcript is blurred on pages 2 and 3 and the university seal is not legible. Please scan the original colour document in full and re-upload all pages as one PDF.',
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

  const civilId = await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Civil ID Card',
      documentType: 'IDENTITY',
      status: DocumentStatus.VERIFIED,
      uploadedAt: new Date('2026-10-01T08:00:00.000Z'),
      lastReviewedAt: new Date('2026-10-02T13:00:00.000Z'),
      verifiedAt: new Date('2026-10-02T13:00:00.000Z'),
    }),
  );
  await reviewRepo.save(
    reviewRepo.create({
      documentId: civilId.id,
      reviewerId: consultant1User.id,
      decision: DocumentReviewDecision.APPROVED,
      reason: null,
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Letter of Recommendation',
      documentType: 'RECOMMENDATION',
      status: DocumentStatus.UNDER_REVIEW,
      uploadedAt: new Date('2026-11-16T12:10:00.000Z'),
      lastReviewedAt: new Date('2026-11-17T09:00:00.000Z'),
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: null,
      title: 'Passport-size Photograph',
      documentType: 'PHOTO',
      status: DocumentStatus.NOT_UPLOADED,
    }),
  );

  // University-specific documents (tied to each application)
  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: kitApp.id,
      title: 'Application Fee Payment Receipt',
      documentType: 'FEE_RECEIPT',
      status: DocumentStatus.UNDER_REVIEW,
      uploadedAt: new Date('2026-11-10T11:00:00.000Z'),
      lastReviewedAt: new Date('2026-11-11T09:00:00.000Z'),
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: kitApp.id,
      title: 'Offer Acceptance Form',
      documentType: 'ACCEPTANCE_FORM',
      status: DocumentStatus.NOT_UPLOADED,
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: ivuApp.id,
      title: 'Entrance Exam Admit Card',
      documentType: 'ADMIT_CARD',
      status: DocumentStatus.VERIFIED,
      uploadedAt: new Date('2026-10-20T08:30:00.000Z'),
      lastReviewedAt: new Date('2026-10-21T10:00:00.000Z'),
      verifiedAt: new Date('2026-10-21T10:00:00.000Z'),
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: ivuApp.id,
      title: 'Waitlist Confirmation Letter',
      documentType: 'WAITLIST_LETTER',
      status: DocumentStatus.UNDER_REVIEW,
      uploadedAt: new Date('2026-11-13T14:20:00.000Z'),
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: pstuApp.id,
      title: 'Passport Data Page',
      documentType: 'PASSPORT',
      status: DocumentStatus.NOT_UPLOADED,
    }),
  );

  await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      applicationId: pstuApp.id,
      title: 'Qatar University Application Form',
      documentType: 'APP_FORM',
      status: DocumentStatus.VERIFIED,
      uploadedAt: new Date('2026-10-12T09:00:00.000Z'),
      lastReviewedAt: new Date('2026-10-13T11:15:00.000Z'),
      verifiedAt: new Date('2026-10-13T11:15:00.000Z'),
    }),
  );

  const emailRepo = dataSource.getRepository(UniversityEmail);
  const consultantMailbox = 'sara.ahmed@scholara.demo';

  // Student only sees consultant → student mail (uni traffic stays with Sara).
  await emailRepo.save(
    emailRepo.create({
      applicationId: pstuApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'Qatar University — application received',
      sender: consultantMailbox,
      sentAt: new Date('2026-10-20T09:15:00.000Z'),
      body: 'Hi Ali,\n\nI submitted your BS Computer Science file to Qatar University and they confirmed receipt. Initial verification is in progress — no action needed from you yet.\n\nI will update you if they ask for anything else.\n\nSara Ahmed\nScholara Admissions',
      studentReply: 'Thanks Sara — good to know. I will wait for your next update.',
      repliedAt: new Date('2026-10-20T12:40:00.000Z'),
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: kitApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'Khalifa University needs a clearer transcript',
      sender: consultantMailbox,
      sentAt: new Date('2026-10-27T12:00:00.000Z'),
      body: 'Hi Ali,\n\nKhalifa University wrote to me: pages 2–3 of your transcript look blurred. Please upload a full-colour PDF in Documents today so I can send the replacement and keep verification moving.\n\nSara',
      studentReply:
        'Understood — I will re-scan tonight and upload the clearer transcript. Thanks for handling KU.',
      repliedAt: new Date('2026-10-27T18:20:00.000Z'),
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: kitApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'Transcript resent to Khalifa — under review',
      sender: consultantMailbox,
      sentAt: new Date('2026-10-28T11:00:00.000Z'),
      body: 'Hi Ali,\n\nI received your new scan and forwarded it to Khalifa Document Review. They should resume verification shortly. No further upload needed unless I ping you.\n\nSara',
      studentReply: null,
      repliedAt: null,
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: ivuApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'AUS entry test result (71/100)',
      sender: consultantMailbox,
      sentAt: new Date('2026-11-01T11:30:00.000Z'),
      body: 'Hi Ali,\n\nAmerican University of Sharjah shared your entry test score with me: 71/100. Their provisional merit list is due around 12 November. I will review your standing when it drops and tell you whether we should confirm interest.\n\nSara',
      studentReply:
        'Thanks for the update. I will keep an eye on Messages for the merit-list note.',
      repliedAt: new Date('2026-11-01T16:05:00.000Z'),
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: kitApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'Important: Khalifa fee AED 45,000 due 15 Nov',
      sender: consultantMailbox,
      sentAt: new Date('2026-11-03T10:15:00.000Z'),
      body: 'Hi Ali,\n\nKhalifa Finance confirmed your offer and the enrollment fee (AED 45,000) is due by 15 November. Please align with your parents on payment timing. If you need me to check the bank reference before you transfer, reply here.\n\nSara',
      studentReply:
        'We are arranging the transfer this week. I will send the receipt screenshot once it clears.',
      repliedAt: new Date('2026-11-03T15:00:00.000Z'),
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: pstuApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'QU asked for passport page + photo',
      sender: consultantMailbox,
      sentAt: new Date('2026-11-05T14:45:00.000Z'),
      body: 'Hi Ali,\n\nQatar University asked me for your passport data page and a passport photo to finish initial verification. Please upload both under the QU application when you can — lower priority than the Khalifa fee, but it keeps QU moving.\n\nSara',
      studentReply: null,
      repliedAt: null,
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: ivuApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'AUS merit list is out — check portal',
      sender: consultantMailbox,
      sentAt: new Date('2026-11-12T09:00:00.000Z'),
      body: 'Hi Ali,\n\nAUS published the provisional merit list. Please open the applicant portal, note your standing, and reply with a screenshot. If you are shortlisted they want interest confirmed within 72 hours — I will draft that for you once I see your band.\n\nSara',
      studentReply: null,
      repliedAt: null,
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: kitApp.id,
      direction: EmailDirection.TO_STUDENT,
      subject: 'KU payment reference confirmed',
      sender: consultantMailbox,
      sentAt: new Date('2026-11-14T16:00:00.000Z'),
      body: 'Hi Ali,\n\nI confirmed the remittance reference with Khalifa Finance: use KU-ENR-AR-2026 on the transfer advice. Once funds clear they will email me a receipt and I will mark the fee step complete.\n\nSara',
      studentReply:
        'Perfect — we will use that reference. I will reply again when the bank posts the transfer.',
      repliedAt: new Date('2026-11-14T19:20:00.000Z'),
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
  // Find-or-create: a live backend may open Messages mid-seed and insert first.
  let conversation = await conversationRepo.findOne({
    where: { studentId: student.id },
  });
  if (!conversation) {
    conversation = await conversationRepo.save(
      conversationRepo.create({
        studentId: student.id,
        consultantId: consultant1.id,
      }),
    );
  } else {
    conversation.consultantId = consultant1.id;
    conversation = await conversationRepo.save(conversation);
    await dmRepo.delete({ conversationId: conversation.id });
  }

  // Always-on messaging: realistic Ali ↔ Sara thread over the past ~9 days.
  const messageAt = (daysAgo: number, hour: number, minute = 0) => {
    const at = new Date();
    at.setUTCDate(at.getUTCDate() - daysAgo);
    at.setUTCHours(hour, minute, 0, 0);
    return at;
  };

  type SeedDm = {
    from: 'student' | 'consultant';
    body: string;
    at: Date;
    /** When set, peer has read the message (typical for older turns). */
    readAt?: Date | null;
  };

  const seededThread: SeedDm[] = [
    {
      from: 'consultant',
      body: 'Hi Ali — welcome back. I reviewed your Gulf shortlist again. Khalifa University is still the strongest fit if we can clear the transcript issue before their fee deadline.',
      at: messageAt(9, 7, 20),
      readAt: messageAt(9, 8, 5),
    },
    {
      from: 'student',
      body: 'Thanks Sara. Document Review said pages 2–3 of my transcript look blurred. I can re-scan at home tonight.',
      at: messageAt(9, 9, 45),
      readAt: messageAt(9, 10, 10),
    },
    {
      from: 'consultant',
      body: 'Perfect. Please upload a full-colour PDF (all pages, no glare). Once it is in Documents I will mark it for review the same day.',
      at: messageAt(9, 10, 25),
      readAt: messageAt(9, 11, 0),
    },
    {
      from: 'student',
      body: 'Uploaded the clearer transcript this morning. Can you check if it looks okay?',
      at: messageAt(8, 6, 15),
      readAt: messageAt(8, 7, 40),
    },
    {
      from: 'consultant',
      body: 'Checked — much better. I moved it to under review. Also flagging the Khalifa enrollment fee (AED 45,000) due 15 November so we do not miss it.',
      at: messageAt(8, 8, 5),
      readAt: messageAt(8, 8, 50),
    },
    {
      from: 'student',
      body: 'Got it. My parents want a quick call before we pay. Are you free later this week?',
      at: messageAt(7, 11, 30),
      readAt: messageAt(7, 12, 10),
    },
    {
      from: 'consultant',
      body: 'Yes — I approved a 1:1 audio slot for 20 November at 10:00. We can cover fee payment, AUS merit list, and Qatar University passport docs in one go.',
      at: messageAt(7, 12, 45),
      readAt: messageAt(7, 13, 20),
    },
    {
      from: 'consultant',
      body: 'Quick update from AUS: your entry test was 71/100 and the provisional merit list is out. Please open the applicant portal and tell me your standing when you can.',
      at: messageAt(6, 5, 50),
      readAt: messageAt(6, 8, 15),
    },
    {
      from: 'student',
      body: 'I am on the waitlist band, not firmly shortlisted yet. They asked me to confirm interest within 72 hours if that changes.',
      at: messageAt(6, 9, 5),
      readAt: messageAt(6, 9, 40),
    },
    {
      from: 'consultant',
      body: 'Noted. Keep Khalifa as plan A for now, and we will only pivot if AUS moves you up. No need to panic-pay anywhere else.',
      at: messageAt(6, 10, 0),
      readAt: messageAt(6, 10, 35),
    },
    {
      from: 'student',
      body: 'Qatar University emailed asking for my passport data page and a passport photo. I have not uploaded those yet.',
      at: messageAt(5, 14, 10),
      readAt: messageAt(4, 6, 20),
    },
    {
      from: 'consultant',
      body: 'Please add both under the Qatar University application in Documents when you can — that keeps initial verification moving even while we focus on Khalifa.',
      at: messageAt(4, 7, 5),
      readAt: messageAt(4, 8, 0),
    },
    {
      from: 'student',
      body: 'Will do after school today. Also — does Fatima (my guardian) see the same fee deadlines in the app?',
      at: messageAt(4, 12, 40),
      readAt: messageAt(4, 13, 15),
    },
    {
      from: 'consultant',
      body: 'Yes. Guardians get a read-only view of your progress and messages, so she can follow the Khalifa fee date without needing a separate login thread.',
      at: messageAt(4, 13, 35),
      readAt: messageAt(4, 14, 10),
    },
    {
      from: 'consultant',
      body: 'Reminder: Khalifa finance invoice is still due 15 November. If payment needs a bank letter, send me a draft and I will sanity-check the reference number.',
      at: messageAt(3, 6, 30),
      readAt: messageAt(3, 9, 0),
    },
    {
      from: 'student',
      body: 'We are arranging the transfer this week. I will share the receipt screenshot as soon as it clears.',
      at: messageAt(3, 10, 20),
      readAt: messageAt(3, 11, 5),
    },
    {
      from: 'student',
      body: 'One more thing — should I prepare anything specific for our call on the 20th?',
      at: messageAt(2, 8, 45),
      readAt: messageAt(2, 9, 30),
    },
    {
      from: 'consultant',
      body: 'Bring: (1) fee payment status, (2) AUS portal screenshot, (3) any questions from your parents. I will bring the document checklist and next-step timeline.',
      at: messageAt(2, 10, 5),
      readAt: messageAt(2, 11, 0),
    },
    {
      from: 'consultant',
      body: 'Hi Ali — please keep the clearer transcript under review and watch that Khalifa fee deadline. Happy to hop on the scheduled call if anything looks off before then.',
      at: messageAt(1, 7, 15),
      readAt: messageAt(1, 8, 40),
    },
    {
      from: 'student',
      body: 'Thanks Sara. Transcript is uploaded, fee transfer is in progress, and I will confirm once finance posts the receipt.',
      at: messageAt(1, 9, 25),
      readAt: null,
    },
    {
      from: 'consultant',
      body: 'Sounds good. Message me anytime — you do not need me to be online for it to save. See you on the call.',
      at: messageAt(0, 6, 50),
      readAt: null,
    },
  ];

  for (const item of seededThread) {
    const saved = await dmRepo.save(
      dmRepo.create({
        conversationId: conversation.id,
        chatSessionId: null,
        senderUserId:
          item.from === 'student' ? studentUser.id : consultant1User.id,
        body: item.body,
        readAt: item.readAt ?? null,
      }),
    );
    // CreateDateColumn ignores manual values on insert — backdate explicitly.
    await dmRepo.update({ id: saved.id }, { createdAt: item.at });
  }

  const latestAt = seededThread[seededThread.length - 1]!.at;
  await conversationRepo.update(
    { id: conversation.id },
    { updatedAt: latestAt },
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
