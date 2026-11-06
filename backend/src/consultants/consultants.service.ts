import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload';
import { UserRole, DocumentStatus } from '../common/enums';
import { StudentProfile } from '../students/student-profile.entity';
import { Document } from '../documents/document.entity';
import { Application } from '../applications/application.entity';
import { CallNote } from '../calls/call-note.entity';
import { AccessService } from '../common/access.service';

@Injectable()
export class ConsultantsService {
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

  async listAssignedStudents(user: JwtPayload) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new ForbiddenException('Consultants only');
    }

    const students = await this.studentsRepo.find({
      where: { consultantId: user.consultantProfileId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    const enriched = await Promise.all(
      students.map(async (student) => {
        const [docs, apps] = await Promise.all([
          this.documentsRepo.find({ where: { studentId: student.id } }),
          this.applicationsRepo.find({ where: { studentId: student.id } }),
        ]);
        return {
          id: student.id,
          fullName: student.user.fullName,
          email: student.user.email,
          targetProgram: student.targetProgram,
          pendingReviews: docs.filter(
            (d) => d.status === DocumentStatus.UNDER_REVIEW,
          ).length,
          rejectedDocuments: docs.filter(
            (d) => d.status === DocumentStatus.REJECTED,
          ).length,
          applications: apps.length,
        };
      }),
    );

    return enriched;
  }

  async listCallNotes(user: JwtPayload, studentId: string) {
    await this.access.resolveReadableStudentId(user, studentId);
    return this.callNotesRepo
      .createQueryBuilder('note')
      .innerJoinAndSelect('note.callSession', 'session')
      .leftJoinAndSelect('session.consultant', 'consultant')
      .leftJoinAndSelect('consultant.user', 'consultantUser')
      .where('session.student_id = :studentId', { studentId })
      .orderBy('note.created_at', 'DESC')
      .getMany();
  }
}
