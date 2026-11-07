import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ example: 'What documents still need review?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  /** Optional for consultants: ground the reply in one assigned student. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
