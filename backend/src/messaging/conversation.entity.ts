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
import { StudentProfile } from '../students/student-profile.entity';
import { ConsultantProfile } from '../consultants/consultant-profile.entity';
import { DirectMessage } from './direct-message.entity';

@Entity('conversations')
@Index('idx_conversations_consultant_id', ['consultantId'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', unique: true })
  studentId!: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  @Column({ name: 'consultant_id' })
  consultantId!: string;

  @ManyToOne(() => ConsultantProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consultant_id' })
  consultant!: ConsultantProfile;

  @OneToMany(() => DirectMessage, (message) => message.conversation)
  messages?: DirectMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
