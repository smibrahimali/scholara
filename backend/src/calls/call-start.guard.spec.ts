import { ForbiddenException } from '@nestjs/common';
import { CallsService } from './calls.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('CallsService.start approval gate (P0 call workflow)', () => {
  const sessionsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const notesRepo = {};
  const access = {};
  const groq = {};
  const callRequests = {
    requireApprovedForStart: jest.fn(),
    attachSession: jest.fn(),
  };

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

  it('rejects students from starting a live call', async () => {
    const student: JwtPayload = {
      sub: 'user-student',
      email: 'student@scholara.demo',
      fullName: 'Ali Raza',
      role: UserRole.STUDENT,
      studentProfileId: 'student-1',
    };

    await expect(
      service.start(student, { callRequestId: 'req-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(callRequests.requireApprovedForStart).not.toHaveBeenCalled();
  });

  it('rejects start when call request is not approved', async () => {
    const consultant: JwtPayload = {
      sub: 'user-c1',
      email: 'consultant1@scholara.demo',
      fullName: 'Sara',
      role: UserRole.CONSULTANT,
      consultantProfileId: 'consultant-1',
    };
    callRequests.requireApprovedForStart.mockRejectedValue(
      new ForbiddenException(
        'Call request must be approved before starting a live call',
      ),
    );

    await expect(
      service.start(consultant, { callRequestId: 'req-pending' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
