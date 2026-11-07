import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTranscriptDto {
  @ApiProperty({
    example: 'Consultant: Fee due 15 Nov. Student: Will re-upload transcript.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  transcript!: string;

  /** When true, append to existing transcript; otherwise replace. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  append?: boolean;
}
