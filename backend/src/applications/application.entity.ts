import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationStatus } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { University } from '../universities/university.entity';
import { Program } from '../programs/program.entity';
import { ApplicationStep } from './application-step.entity';
import { UniversityEmail } from '../emails/university-email.entity';
import { ApplicationStatusHistory } from './application-status-history.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_applications_student_id')
  @Column({ name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => StudentProfile, (student) => student.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  @Column({ name: 'university_id' })
  universityId!: string;

  @ManyToOne(() => University, (university) => university.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'university_id' })
  university!: University;

  @Column({ name: 'program_id' })
  programId!: string;

  @ManyToOne(() => Program, (program) => program.applications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'program_id' })
  program!: Program;

  @Column({ type: 'enum', enum: ApplicationStatus })
  status!: ApplicationStatus;

  @Column({ name: 'intake_year', type: 'int', nullable: true })
  intakeYear!: number | null;

  @Column({ name: 'intake_term', type: 'varchar', length: 16, nullable: true })
  intakeTerm!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'decision_at', type: 'timestamptz', nullable: true })
  decisionAt!: Date | null;

  @Column({ name: 'fee_paid_at', type: 'timestamptz', nullable: true })
  feePaidAt!: Date | null;

  @Column({ name: 'enrollment_confirmed_at', type: 'timestamptz', nullable: true })
  enrollmentConfirmedAt!: Date | null;

  @Column({ name: 'waitlist_position', type: 'int', nullable: true })
  waitlistPosition!: number | null;

  @Column({ name: 'waitlist_updated_at', type: 'timestamptz', nullable: true })
  waitlistUpdatedAt!: Date | null;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decisionNotes!: string | null;

  @Column({ name: 'fee_amount', type: 'numeric', nullable: true })
  feeAmount!: string | null;

  @Column({ name: 'fee_currency', type: 'varchar', length: 16, nullable: true })
  feeCurrency!: string | null;

  @Column({ name: 'fee_due_date', type: 'date', nullable: true })
  feeDueDate!: string | null;

  @Column({ name: 'merit_list_date', type: 'date', nullable: true })
  meritListDate!: string | null;

  @Column({ name: 'entry_score', type: 'numeric', nullable: true })
  entryScore!: string | null;

  @OneToMany(() => ApplicationStep, (step) => step.application)
  steps?: ApplicationStep[];

  @OneToMany(() => UniversityEmail, (email) => email.application)
  emails?: UniversityEmail[];

  @OneToMany(() => ApplicationStatusHistory, (history) => history.application)
  statusHistory?: ApplicationStatusHistory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
