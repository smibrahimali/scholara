import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DocumentReviewDecision,
  DocumentStatus,
  UserRole,
} from '../common/enums';
import { AccessService } from '../common/access.service';
import { JwtPayload } from '../auth/jwt-payload';
import { Document } from './document.entity';
import { DocumentReview } from './document-review.entity';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { StorageService } from '../storage/storage.service';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(DocumentReview)
    private readonly reviewsRepo: Repository<DocumentReview>,
    private readonly access: AccessService,
    private readonly storage: StorageService,
  ) {}

  async listForUser(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );
    const docs = await this.documentsRepo.find({
      where: { studentId: resolvedStudentId },
      relations: { reviews: { reviewer: true } },
      order: { updatedAt: 'DESC' },
    });
    return docs.map((d) => this.toDto(d));
  }

  async upload(
    user: JwtPayload,
    documentId: string,
    file?: Express.Multer.File,
  ) {
    if (user.role !== UserRole.STUDENT || !user.studentProfileId) {
      throw new ForbiddenException('Only students can upload documents');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File must be 8 MB or smaller');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Allowed types: PDF, JPG, PNG, WEBP, DOC, DOCX',
      );
    }
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'Storage is not configured on the server',
      );
    }

    const document = await this.documentsRepo.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (document.studentId !== user.studentProfileId) {
      throw new ForbiddenException('Cannot upload for another student');
    }
    const canReplaceByStatus =
      document.status === DocumentStatus.NOT_UPLOADED ||
      document.status === DocumentStatus.REJECTED ||
      (document.status === DocumentStatus.UNDER_REVIEW &&
        !document.storagePath);
    if (
      document.status === DocumentStatus.VERIFIED ||
      !canReplaceByStatus
    ) {
      throw new BadRequestException(
        'Only missing or rejected documents can be uploaded',
      );
    }

    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    const path = `${document.studentId}/${document.id}/${Date.now()}-${safeName}`;

    if (document.storagePath) {
      await this.storage.removeObject(document.storagePath);
    }

    await this.storage.uploadObject(path, file.buffer, file.mimetype);

    document.storagePath = path;
    document.status = DocumentStatus.UNDER_REVIEW;
    document.rejectionReason = null;
    await this.documentsRepo.save(document);

    const saved = await this.documentsRepo.findOne({
      where: { id: document.id },
      relations: { reviews: { reviewer: true } },
    });
    return this.toDto(saved!);
  }

  async getDownloadUrl(user: JwtPayload, documentId: string) {
    const document = await this.documentsRepo.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.access.resolveReadableStudentId(user, document.studentId);

    if (!document.storagePath) {
      throw new NotFoundException(
        'No file uploaded for this document. Please upload again.',
      );
    }
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'Storage is not configured on the server',
      );
    }

    const exists = await this.storage.objectExists(document.storagePath);
    if (!exists) {
      await this.clearMissingFile(document);
      throw new NotFoundException(
        'File is missing from storage. Please upload again.',
      );
    }

    try {
      const url = await this.storage.createSignedUrl(document.storagePath);
      return { url, expiresInSeconds: 600 };
    } catch {
      await this.clearMissingFile(document);
      throw new NotFoundException(
        'File is missing from storage. Please upload again.',
      );
    }
  }

  /** Clear stale DB pointer when the Storage object was deleted manually. */
  private async clearMissingFile(document: Document) {
    document.storagePath = null;
    if (document.status !== DocumentStatus.REJECTED) {
      document.status = DocumentStatus.NOT_UPLOADED;
      document.rejectionReason = null;
    }
    await this.documentsRepo.save(document);
  }

  async review(user: JwtPayload, documentId: string, dto: ReviewDocumentDto) {
    if (user.role !== UserRole.CONSULTANT || !user.consultantProfileId) {
      throw new BadRequestException('Only consultants can review documents');
    }
    if (dto.decision === DocumentReviewDecision.REJECTED && !dto.reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const document = await this.documentsRepo.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.access.assertConsultantOwnsStudent(
      user.consultantProfileId,
      document.studentId,
    );

    document.status =
      dto.decision === DocumentReviewDecision.APPROVED
        ? DocumentStatus.VERIFIED
        : DocumentStatus.REJECTED;
    document.rejectionReason =
      dto.decision === DocumentReviewDecision.REJECTED ? dto.reason! : null;

    await this.documentsRepo.save(document);
    await this.reviewsRepo.save(
      this.reviewsRepo.create({
        documentId: document.id,
        reviewerId: user.sub,
        decision: dto.decision,
        reason: dto.reason ?? null,
      }),
    );

    const saved = await this.documentsRepo.findOne({
      where: { id: document.id },
      relations: { reviews: { reviewer: true } },
    });
    return this.toDto(saved!);
  }

  private toDto(document: Document) {
    return {
      ...document,
      hasFile: Boolean(document.storagePath),
    };
  }
}
