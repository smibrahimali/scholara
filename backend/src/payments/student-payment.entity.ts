import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentCategory, PaymentStatus } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { Application } from '../applications/application.entity';

@Entity('student_payments')
export class StudentPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_student_payments_student_id')
  @Column({ name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId!: string | null;

  @ManyToOne(() => Application, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'application_id' })
  application!: Application | null;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: PaymentCategory,
    enumName: 'student_payments_category_enum',
  })
  category!: PaymentCategory;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'student_payments_status_enum',
  })
  status!: PaymentStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  /** Calendar date for paid-on or due-on (demo ledger). */
  @Column({ name: 'occurred_on', type: 'date' })
  occurredOn!: string;

  @Column({ name: 'payee_label', type: 'varchar', length: 160, nullable: true })
  payeeLabel!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
