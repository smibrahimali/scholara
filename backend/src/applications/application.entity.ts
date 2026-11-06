import {
  Column,
  CreateDateColumn,
  Entity,
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

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
