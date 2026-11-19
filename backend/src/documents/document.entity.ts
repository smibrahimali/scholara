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
import { DocumentStatus } from '../common/enums';
import { Application } from '../applications/application.entity';
import { StudentProfile } from '../students/student-profile.entity';
import { DocumentReview } from './document-review.entity';

@Entity('documents')
@Index('idx_documents_student_status', ['studentId', 'status'])
@Index('idx_documents_student_application', ['studentId', 'applicationId'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_documents_student_id')
  @Column({ name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => StudentProfile, (student) => student.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student!: StudentProfile;

  /** Null = general document; set = university-specific for that application. */
  @Index('idx_documents_application_id')
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId!: string | null;

  @ManyToOne(() => Application, (application) => application.documents, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'application_id' })
  application?: Application | null;

  @Column()
  title!: string;

  @Column({ name: 'document_type' })
  documentType!: string;

  @Column({ type: 'enum', enum: DocumentStatus })
  status!: DocumentStatus;

  @Column({
    name: 'storage_path',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  storagePath!: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: true })
  uploadedAt!: Date | null;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt!: Date | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  @OneToMany(() => DocumentReview, (review) => review.document)
  reviews?: DocumentReview[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
