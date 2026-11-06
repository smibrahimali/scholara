import {
  BadRequestException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepo: Repository<Document>,
    @InjectRepository(DocumentReview)
    private readonly reviewsRepo: Repository<DocumentReview>,
    private readonly access: AccessService,
  ) {}

  async listForUser(user: JwtPayload, studentId?: string) {
    const resolvedStudentId = await this.access.resolveReadableStudentId(
      user,
      studentId,
    );
    return this.documentsRepo.find({
      where: { studentId: resolvedStudentId },
      relations: { reviews: { reviewer: true } },
      order: { updatedAt: 'DESC' },
    });
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

    return this.documentsRepo.findOne({
      where: { id: document.id },
      relations: { reviews: { reviewer: true } },
    });
  }
}
