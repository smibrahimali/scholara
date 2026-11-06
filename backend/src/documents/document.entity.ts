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
import { DocumentStatus } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { DocumentReview } from './document-review.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => StudentProfile, (student) => student.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  @Column()
  title!: string;

  @Column({ name: 'document_type' })
  documentType!: string;

  @Column({ type: 'enum', enum: DocumentStatus })
  status!: DocumentStatus;

  @Column({ name: 'storage_path', type: 'varchar', length: 512, nullable: true })
  storagePath!: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @OneToMany(() => DocumentReview, (review) => review.document)
  reviews?: DocumentReview[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
