import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApplicationStatus } from '../common/enums';
import { Application } from './application.entity';
import { User } from '../users/user.entity';

@Entity('application_status_history')
export class ApplicationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'application_id' })
  applicationId!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application!: Application;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: ApplicationStatus,
    nullable: true,
  })
  fromStatus!: ApplicationStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: ApplicationStatus })
  toStatus!: ApplicationStatus;

  @Column({ name: 'changed_by_user_id', nullable: true })
  changedByUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedBy?: User | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt!: Date;
}
