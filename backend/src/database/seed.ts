import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import {
  ApplicationStatus,
  ApplicationStepStatus,
  DocumentReviewDecision,
  DocumentStatus,
  UserRole,
} from '../common/enums';
import { entities } from './database.module';
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

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env') });

async function createSteps(
  dataSource: DataSource,
  applicationId: string,
  completedThrough: number,
  skipped: number[] = [],
) {
  const stepRepo = dataSource.getRepository(ApplicationStep);
  for (let n = 1; n <= 12; n += 1) {
    let status = ApplicationStepStatus.NOT_STARTED;
    let completedAt: Date | null = null;
    if (skipped.includes(n)) {
      status = ApplicationStepStatus.SKIPPED;
    } else if (n < completedThrough) {
      status = ApplicationStepStatus.COMPLETED;
      completedAt = new Date();
    } else if (n === completedThrough) {
      status = ApplicationStepStatus.IN_PROGRESS;
    }

    await stepRepo.save(
      stepRepo.create({
        applicationId,
        stepNumber: n,
        label: APPLICATION_STEP_LABELS[n],
        status,
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
    ssl: { rejectUnauthorized: false },
  });

  await dataSource.initialize();
  console.log('Connected. Clearing and seeding demo data...');

  // Clear in FK-safe order
  await dataSource.getRepository(CallNote).createQueryBuilder().delete().execute();
  await dataSource.getRepository(CallSession).createQueryBuilder().delete().execute();
  await dataSource.getRepository(DocumentReview).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Document).createQueryBuilder().delete().execute();
  await dataSource.getRepository(UniversityEmail).createQueryBuilder().delete().execute();
  await dataSource.getRepository(ApplicationStep).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Application).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Program).createQueryBuilder().delete().execute();
  await dataSource.getRepository(University).createQueryBuilder().delete().execute();
  await dataSource.getRepository(GuardianProfile).createQueryBuilder().delete().execute();
  await dataSource.getRepository(StudentProfile).createQueryBuilder().delete().execute();
  await dataSource.getRepository(ConsultantProfile).createQueryBuilder().delete().execute();
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
      name: 'Punjab Science and Technology University',
      city: 'Lahore',
      country: 'Pakistan',
    }),
  );
  const ivu = await universityRepo.save(
    universityRepo.create({
      name: 'Indus Valley University',
      city: 'Karachi',
      country: 'Pakistan',
    }),
  );
  const kit = await universityRepo.save(
    universityRepo.create({
      name: 'KIT',
      city: 'Karachi',
      country: 'Pakistan',
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
      decisionNotes: 'Application under review by admissions office.',
    }),
  );
  const ivuApp = await applicationRepo.save(
    applicationRepo.create({
      studentId: student.id,
      universityId: ivu.id,
      programId: ivuSe.id,
      status: ApplicationStatus.WAITLISTED,
      entryScore: '71',
      meritListDate: '2026-11-12',
      decisionNotes: 'Entry test score 71/100. Merit list expected 12 November.',
    }),
  );
  const kitApp = await applicationRepo.save(
    applicationRepo.create({
      studentId: student.id,
      universityId: kit.id,
      programId: kitCs.id,
      status: ApplicationStatus.ACCEPTED,
      feeAmount: '148000',
      feeCurrency: 'PKR',
      feeDueDate: '2026-11-15',
      decisionNotes: 'Offer accepted pending fee confirmation.',
    }),
  );

  await createSteps(dataSource, pstuApp.id, 6);
  await createSteps(dataSource, ivuApp.id, 8);
  await createSteps(dataSource, kitApp.id, 11, [7]);

  const documentRepo = dataSource.getRepository(Document);
  const reviewRepo = dataSource.getRepository(DocumentReview);

  const transcript = await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      title: 'Official Transcript',
      documentType: 'TRANSCRIPT',
      status: DocumentStatus.REJECTED,
      rejectionReason: 'Blurred scan, last page missing.',
      storagePath: null,
    }),
  );
  await reviewRepo.save(
    reviewRepo.create({
      documentId: transcript.id,
      reviewerId: consultant1User.id,
      decision: DocumentReviewDecision.REJECTED,
      reason: 'Blurred scan, last page missing.',
    }),
  );

  const cnic = await documentRepo.save(
    documentRepo.create({
      studentId: student.id,
      title: 'CNIC / B-Form',
      documentType: 'IDENTITY',
      status: DocumentStatus.VERIFIED,
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
      sender: 'admissions@indusvalley.edu.demo',
      sentAt: new Date('2026-11-01T10:00:00.000Z'),
      body: 'Dear Ali Raza,\n\nYour entry test score is 71/100. The merit list will be published on 12 November.\n\nRegards,\nIndus Valley University Admissions',
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: kitApp.id,
      subject: 'Fee Challan and Enrollment Deadline',
      sender: 'finance@kit.edu.demo',
      sentAt: new Date('2026-11-03T09:00:00.000Z'),
      body: 'Dear Ali Raza,\n\nCongratulations on your admission offer. Your fee of PKR 148,000 is due by 15 November 2026.\n\nRegards,\nKIT Finance Office',
    }),
  );
  await emailRepo.save(
    emailRepo.create({
      applicationId: pstuApp.id,
      subject: 'Application Received',
      sender: 'admissions@pstu.edu.demo',
      sentAt: new Date('2026-10-20T08:30:00.000Z'),
      body: 'Dear Ali Raza,\n\nWe have received your application to BS Computer Science. Initial verification is in progress.\n\nRegards,\nPSTU Admissions',
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
        'Discussed KIT fee deadline of 15 November 2026 and Indus Valley merit list on 12 November. Student will re-upload blurred transcript.',
    }),
  );
  await noteRepo.save(
    noteRepo.create({
      callSessionId: call.id,
      summary:
        'Reviewed application progress. KIT offer fee pending; Indus Valley waitlisted pending merit list; transcript rejected and needs re-upload.',
      actionItems:
        '1) Student re-uploads transcript\n2) Confirm KIT fee payment plan\n3) Monitor Indus Valley merit list on 12 November',
      universitiesDiscussed: 'KIT, Indus Valley University, Punjab Science and Technology University',
      followUps: 'Follow up on transcript re-upload before 10 November 2026.',
    }),
  );

  // Keep consultant2 available for reassignment demos (no students yet)
  void consultant2;

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
