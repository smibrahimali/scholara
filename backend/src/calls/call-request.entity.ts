import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CallRequestStatus } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { ConsultantProfile } from '../consultants/consultant-profile.entity';
import { CallSession } from './call-session.entity';

@Entity('call_requests')
@Index('uq_call_requests_active_student', ['studentId'], {
  unique: true,
  where: `"status" IN ('PENDING', 'APPROVED')`,
})
export class CallRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  @Column({ name: 'consultant_id' })
  consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultant_id' })
  consultant!: ConsultantProfile;

  @Column({ name: 'scheduled_for', type: 'timestamptz' })
  scheduledFor!: Date;

  @Column({
    type: 'enum',
    enum: CallRequestStatus,
    default: CallRequestStatus.PENDING,
  })
  status!: CallRequestStatus;

  @Column({ name: 'student_note', type: 'text', nullable: true })
  studentNote!: string | null;

  @Column({ name: 'consultant_note', type: 'text', nullable: true })
  consultantNote!: string | null;

  @Column({ name: 'call_session_id', type: 'uuid', nullable: true })
  callSessionId!: string | null;

  @ManyToOne(() => CallSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'call_session_id' })
  callSession?: CallSession | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
