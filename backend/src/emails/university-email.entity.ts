import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmailDirection } from '../common/enums';
import { Application } from '../applications/application.entity';

@Entity('university_emails')
export class UniversityEmail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id' })
  applicationId!: string;

  @ManyToOne(() => Application, (application) => application.emails, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application!: Application;

  @Column({
    type: 'varchar',
    length: 20,
    default: EmailDirection.TO_STUDENT,
  })
  direction!: EmailDirection;

  @Column()
  subject!: string;

  /** Always the consultant mailbox for student-facing rows. */
  @Column()
  sender!: string;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;

  /** What the consultant conveyed to the student. */
  @Column({ type: 'text' })
  body!: string;

  /** Student's reply to the consultant (null until they respond). */
  @Column({ name: 'student_reply', type: 'text', nullable: true })
  studentReply!: string | null;

  @Column({ name: 'replied_at', type: 'timestamptz', nullable: true })
  repliedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
