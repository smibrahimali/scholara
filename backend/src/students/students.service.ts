import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessService } from '../common/access.service';
import { JwtPayload } from '../auth/jwt-payload';
import { StudentProfile } from './student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { DocumentStatus, UserRole } from '../common/enums';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(Application)
    private readonly applicationsRepo: Repository<Application>,
    @InjectRepository(CallNote)
    private readonly callNotesRepo: Repository<CallNote>,
    private readonly access: AccessService,
  ) {}

  async getDashboard(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );

    const student = await this.studentsRepo.findOne({
      where: { id: resolvedStudentId },
      relations: {
        user: true,
        consultant: { user: true },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const [documents, applications, callNotes, statusRows, activeApplications] =
      await Promise.all([
        this.documentsRepo.find({
          where: { studentId: resolvedStudentId },
          order: { updatedAt: 'DESC' },
          take: 12,
        }),
        this.applicationsRepo.find({
          where: { studentId: resolvedStudentId },
          relations: { university: true, program: true, steps: true },
          order: { updatedAt: 'DESC' },
          take: 6,
        }),
        this.callNotesRepo
          .createQueryBuilder('note')
          .innerJoinAndSelect('note.callSession', 'session')
          .where('session.studentId = :studentId', {
            studentId: resolvedStudentId,
          })
          .orderBy('note.createdAt', 'DESC')
          .take(5)
          .getMany(),
        this.documentsRepo
          .createQueryBuilder('d')
          .select('d.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('d.student_id = :studentId', {
            studentId: resolvedStudentId,
          })
          .groupBy('d.status')
          .getRawMany<{ status: DocumentStatus; count: string }>(),
        this.applicationsRepo.count({
          where: { studentId: resolvedStudentId },
        }),
      ]);

    const statusCounts = Object.fromEntries(
      statusRows.map((row) => [row.status, Number(row.count)]),
    ) as Partial<Record<DocumentStatus, number>>;

    const counts = {
      pendingDocuments:
        (statusCounts[DocumentStatus.UNDER_REVIEW] ?? 0) +
        (statusCounts[DocumentStatus.NOT_UPLOADED] ?? 0),
      verifiedDocuments: statusCounts[DocumentStatus.VERIFIED] ?? 0,
      rejectedDocuments: statusCounts[DocumentStatus.REJECTED] ?? 0,
      activeApplications,
    };

    const deadlines = applications
      .flatMap((app) => {
        const items: Array<{
          label: string;
          date: string;
          university: string;
          applicationId: string;
        }> = [];
        if (app.feeDueDate) {
          items.push({
            label: 'Fee due',
            date: app.feeDueDate,
            university: app.university.name,
            applicationId: app.id,
          });
        }
        if (app.meritListDate) {
          items.push({
            label: 'Merit list',
            date: app.meritListDate,
            university: app.university.name,
            applicationId: app.id,
          });
        }
        return items;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      student: {
        id: student.id,
        fullName: student.user.fullName,
        email: student.user.email,
        phone: student.phone,
        targetProgram: student.targetProgram,
        consultant: student.consultant
          ? {
              id: student.consultant.id,
              fullName: student.consultant.user.fullName,
              title: student.consultant.title,
            }
          : null,
      },
      counts,
      documents,
      applications,
      deadlines,
      recentCallNotes: callNotes,
      readOnly: user.role === UserRole.GUARDIAN,
    };
  }
}
