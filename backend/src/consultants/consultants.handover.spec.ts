import { ForbiddenException } from '@nestjs/common';
import { ConsultantsService } from './consultants.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('ConsultantsService handover transaction (P0-2/P0-3/P1-1)', () => {
  const studentsRepo = { findOne: jest.fn(), save: jest.fn() };
  const documentsRepo = { find: jest.fn(), count: jest.fn() };
  const applicationsRepo = { find: jest.fn(), count: jest.fn() };
  const callNotesRepo = {};
  const sessionsRepo = { find: jest.fn(), count: jest.fn() };
  const consultantsRepo = { findOne: jest.fn() };
  const access = {
    assertConsultantOwnsStudent: jest.fn(),
  };

  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) =>
      fn(manager),
    ),
  };

  let service: ConsultantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConsultantsService(
      studentsRepo as never,
      documentsRepo as never,
      applicationsRepo as never,
      callNotesRepo as never,
      sessionsRepo as never,
      consultantsRepo as never,
      access as never,
      dataSource as never,
    );
  });

  const consultant1: JwtPayload = {
    sub: 'user-c1',
    email: 'consultant1@scholara.demo',
    fullName: 'Sara',
    role: UserRole.CONSULTANT,
    consultantProfileId: 'consultant-1',
  };

  it('runs handover inside a transaction and reassigns active requests', async () => {
    access.assertConsultantOwnsStudent.mockResolvedValue({
      id: 'student-1',
      consultantId: 'consultant-1',
    });
    consultantsRepo.findOne.mockResolvedValue({
      id: 'consultant-2',
      user: {
        fullName: 'Bilal',
        email: 'consultant2@scholara.demo',
        role: UserRole.CONSULTANT,
      },
    });

    manager.findOne
      .mockResolvedValueOnce({
        id: 'student-1',
        consultantId: 'consultant-1',
        user: { fullName: 'Ali Raza' },
      })
      .mockResolvedValueOnce({
        id: 'student-1',
        consultantId: 'consultant-2',
        user: { fullName: 'Ali Raza' },
        consultant: {
          user: { fullName: 'Bilal', email: 'consultant2@scholara.demo' },
        },
      });
    manager.find
      .mockResolvedValueOnce([]) // open calls
      .mockResolvedValueOnce([
        { id: 'chat-session-1', studentId: 'student-1', endedAt: null },
      ]); // open chats
    manager.count.mockResolvedValue(1);
    manager.save.mockImplementation((_entity: unknown, value: unknown) =>
      Promise.resolve(value),
    );
    manager.delete.mockResolvedValue(undefined);
    manager.update.mockResolvedValue(undefined);

    const result = await service.handover(consultant1, {
      studentId: 'student-1',
      toConsultantId: 'consultant-2',
    });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalled();
    expect(result.closedOpenChats).toBe(1);
    expect(result.toConsultant.id).toBe('consultant-2');
  });

  it('rejects handover for a student not owned by the caller', async () => {
    access.assertConsultantOwnsStudent.mockRejectedValue(
      new ForbiddenException('Student is not assigned to you'),
    );

    await expect(
      service.handover(consultant1, {
        studentId: 'student-1',
        toConsultantId: 'consultant-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
