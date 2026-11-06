import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationStepStatus } from '../common/enums';
import { Application } from './application.entity';

export const APPLICATION_STEP_LABELS: Record<number, string> = {
  1: 'Admission announcement',
  2: 'Student registration',
  3: 'Program selection',
  4: 'Application submission',
  5: 'Application fee payment',
  6: 'Initial verification',
  7: 'Entry test/interview',
  8: 'Merit calculation/list',
  9: 'Admission decision',
  10: 'Offer letter/fee challan',
  11: 'Fee payment/confirmation',
  12: 'Enrollment',
};

@Entity('application_steps')
@Unique(['applicationId', 'stepNumber'])
export class ApplicationStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id' })
  applicationId!: string;

  @ManyToOne(() => Application, (application) => application.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application!: Application;

  @Column({ name: 'step_number', type: 'int' })
  stepNumber!: number;

  @Column()
  label!: string;

  @Column({ type: 'enum', enum: ApplicationStepStatus })
  status!: ApplicationStepStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
