import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('CallsService ownership after handover (P1-2)', () => {
  const sessionsRepo = {
    findOne: jest.fn(),
  };
  const notesRepo = {};
  const access = {
    assertConsultantOwnsStudent: jest.fn(),
    resolveReadableStudentId: jest.fn(),
  };
  const groq = {};
  const callRequests = {};

  let service: CallsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CallsService(
      sessionsRepo as never,
      notesRepo as never,
      access as never,
      groq as never,
      callRequests as never,
    );
  });

  const formerConsultant: JwtPayload = {
    sub: 'user-c1',
    email: 'consultant1@scholara.demo',
    fullName: 'Sara',
    role: UserRole.CONSULTANT,
    consultantProfileId: 'consultant-1',
  };

  it('rejects transcript mutation when student was handed over', async () => {
    sessionsRepo.findOne.mockResolvedValue({
      id: 'call-1',
      studentId: 'student-1',
      consultantId: 'consultant-1',
      transcript: null,
    });
    access.assertConsultantOwnsStudent.mockRejectedValue(
      new NotFoundException('Assigned student not found'),
    );

    await expect(
      service.updateTranscript(formerConsultant, 'call-1', {
        transcript: 'leaked',
        append: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects join when consultant no longer owns the student', async () => {
    sessionsRepo.findOne.mockResolvedValue({
      id: 'call-1',
      studentId: 'student-1',
      consultantId: 'consultant-1',
      endedAt: null,
    });
    access.resolveReadableStudentId.mockRejectedValue(
      new ForbiddenException('Student is not assigned to you'),
    );

    await expect(
      service.assertCanJoinLiveCall(formerConsultant, 'call-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
