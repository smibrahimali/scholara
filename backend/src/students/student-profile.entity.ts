import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ConsultantProfile } from '../consultants/consultant-profile.entity';
import { Application } from '../applications/application.entity';
import { Document } from '../documents/document.entity';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @OneToOne(() => User, (user) => user.studentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'consultant_id', nullable: true })
  consultantId!: string | null;

  @ManyToOne(() => ConsultantProfile, (consultant) => consultant.students, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'consultant_id' })
  consultant?: ConsultantProfile | null;

  @Column({ nullable: true })
  phone?: string;

  @Column({ name: 'target_program', nullable: true })
  targetProgram?: string;

  @OneToMany(() => Application, (application) => application.student)
  applications?: Application[];

  @OneToMany(() => Document, (document) => document.student)
  documents?: Document[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
