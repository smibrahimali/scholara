import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CallSession } from './call-session.entity';

@Entity('call_notes')
export class CallNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'call_session_id', unique: true })
  callSessionId!: string;

  @OneToOne(() => CallSession, (session) => session.note, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'call_session_id' })
  callSession!: CallSession;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ name: 'action_items', type: 'text' })
  actionItems!: string;

  @Column({ name: 'universities_discussed', type: 'text' })
  universitiesDiscussed!: string;

  @Column({ name: 'follow_ups', type: 'text' })
  followUps!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
