import { BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../auth/jwt-payload';

describe('DocumentsService upload edge cases', () => {
  const documentsRepo = { findOne: jest.fn(), save: jest.fn() };
  const reviewsRepo = {};
  const access = {};
  const storage = {
    isConfigured: jest.fn(() => true),
    uploadObject: jest.fn(),
    removeObject: jest.fn(),
  };

  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(
      documentsRepo as never,
      reviewsRepo as never,
      access as never,
      storage as never,
    );
  });

  const student: JwtPayload = {
    sub: 'user-student',
    email: 'student@scholara.demo',
    fullName: 'Ali Raza',
    role: UserRole.STUDENT,
    studentProfileId: 'student-1',
  };

  it('rejects empty (0-byte) uploads', async () => {
    await expect(
      service.upload(student, 'doc-1', {
        originalname: 'empty.pdf',
        mimetype: 'application/pdf',
        size: 0,
        buffer: Buffer.alloc(0),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.uploadObject).not.toHaveBeenCalled();
  });
});
