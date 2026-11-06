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

    const [documents, applications, callNotes] = await Promise.all([
      this.documentsRepo.find({
        where: { studentId: resolvedStudentId },
        order: { updatedAt: 'DESC' },
      }),
      this.applicationsRepo.find({
        where: { studentId: resolvedStudentId },
        relations: { university: true, program: true, steps: true },
        order: { updatedAt: 'DESC' },
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
    ]);

    const counts = {
      pendingDocuments: documents.filter(
        (d) =>
          d.status === DocumentStatus.UNDER_REVIEW ||
          d.status === DocumentStatus.NOT_UPLOADED,
      ).length,
      verifiedDocuments: documents.filter(
        (d) => d.status === DocumentStatus.VERIFIED,
      ).length,
      rejectedDocuments: documents.filter(
        (d) => d.status === DocumentStatus.REJECTED,
      ).length,
      activeApplications: applications.length,
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
