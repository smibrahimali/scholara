import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentProfile } from '../students/student-profile.entity';
import { ConsultantProfile } from '../consultants/consultant-profile.entity';
import { CallNote } from './call-note.entity';

@Entity('call_sessions')
@Index('idx_call_sessions_student_ended', ['studentId', 'endedAt'])
export class CallSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_call_sessions_student_id')
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

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  transcript!: string | null;

  @OneToOne(() => CallNote, (note) => note.callSession)
  note?: CallNote;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
