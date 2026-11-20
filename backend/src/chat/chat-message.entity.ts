import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('chat_messages')
@Index('idx_chat_messages_user_created', ['userId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_chat_messages_user_id')
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /**
   * Dossier scope for this turn.
   * - Student/guardian: their readable student profile id
   * - Consultant in a dossier: that student id
   * - Consultant desk (no dossier): null
   */
  @Index('idx_chat_messages_context_student_id')
  @Column({ name: 'context_student_id', type: 'uuid', nullable: true })
  contextStudentId!: string | null;

  @Column()
  role!: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
