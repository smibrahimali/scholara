import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './enums';
import { JwtPayload } from '../auth/jwt-payload';
import { StudentProfile } from '../students/student-profile.entity';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentsRepo: Repository<StudentProfile>,
  ) {}

  /** Resolve the student profile the caller is allowed to view. */
  async resolveReadableStudentId(
    user: JwtPayload,
    requestedStudentId?: string,
  ): Promise<string> {
    if (user.role === UserRole.STUDENT) {
      if (!user.studentProfileId) {
        throw new ForbiddenException('Student profile missing');
      }
      if (requestedStudentId && requestedStudentId !== user.studentProfileId) {
        throw new ForbiddenException('Cannot access another student');
      }
      return user.studentProfileId;
    }

    if (user.role === UserRole.GUARDIAN) {
      if (!user.linkedStudentId) {
        throw new ForbiddenException('No linked student');
      }
      if (requestedStudentId && requestedStudentId !== user.linkedStudentId) {
        throw new ForbiddenException('Cannot access another student');
      }
      return user.linkedStudentId;
    }

    if (user.role === UserRole.CONSULTANT) {
      if (!user.consultantProfileId) {
        throw new ForbiddenException('Consultant profile missing');
      }
      if (!requestedStudentId) {
        throw new ForbiddenException('studentId is required for consultants');
      }
      const student = await this.studentsRepo.findOne({
        where: {
          id: requestedStudentId,
          consultantId: user.consultantProfileId,
        },
      });
      if (!student) {
        throw new ForbiddenException('Student is not assigned to you');
      }
      return student.id;
    }

    throw new ForbiddenException('Unsupported role');
  }

  async assertConsultantOwnsStudent(
    consultantProfileId: string,
    studentId: string,
  ): Promise<StudentProfile> {
    const student = await this.studentsRepo.findOne({
      where: { id: studentId, consultantId: consultantProfileId },
      relations: { user: true },
    });
    if (!student) {
      throw new NotFoundException('Assigned student not found');
    }
    return student;
  }
}
