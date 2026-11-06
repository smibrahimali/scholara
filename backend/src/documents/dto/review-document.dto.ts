import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { DocumentReviewDecision } from '../../common/enums';

export class ReviewDocumentDto {
  @ApiProperty({ enum: DocumentReviewDecision })
  @IsEnum(DocumentReviewDecision)
  decision!: DocumentReviewDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
