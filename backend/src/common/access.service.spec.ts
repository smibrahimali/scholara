import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';
import { UserRole } from './enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('AccessService IDOR guards (P0/P1)', () => {
  const studentsRepo = {
    findOne: jest.fn(),
  };

  let service: AccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessService(studentsRepo as never);
  });

  const student: JwtPayload = {
    sub: 'user-student',
    email: 'student@scholara.demo',
    fullName: 'Ali Raza',
    role: UserRole.STUDENT,
    studentProfileId: 'student-1',
  };

  const guardian: JwtPayload = {
    sub: 'user-guardian',
    email: 'guardian@scholara.demo',
    fullName: 'Guardian',
    role: UserRole.GUARDIAN,
    linkedStudentId: 'student-1',
  };

  const consultant1: JwtPayload = {
    sub: 'user-c1',
    email: 'consultant1@scholara.demo',
    fullName: 'Sara',
    role: UserRole.CONSULTANT,
    consultantProfileId: 'consultant-1',
  };

  it('blocks a student from resolving another studentId', async () => {
    await expect(
      service.resolveReadableStudentId(student, 'student-other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a guardian from resolving an unlinked studentId', async () => {
    await expect(
      service.resolveReadableStudentId(guardian, 'student-other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks consultant2 from asserting ownership of consultant1 student', async () => {
    studentsRepo.findOne.mockResolvedValue(null);
    await expect(
      service.assertConsultantOwnsStudent('consultant-2', 'student-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(studentsRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'student-1', consultantId: 'consultant-2' },
      relations: { user: true },
    });
  });

  it('allows assigned consultant to resolve their student', async () => {
    studentsRepo.findOne.mockResolvedValue({ id: 'student-1' });
    await expect(
      service.resolveReadableStudentId(consultant1, 'student-1'),
    ).resolves.toBe('student-1');
  });
});
