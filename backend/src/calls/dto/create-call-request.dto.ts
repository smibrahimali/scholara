import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCallRequestDto {
  @ApiProperty({
    description: 'Preferred call date/time (ISO 8601)',
    example: '2026-11-20T15:00:00.000Z',
  })
  @IsDateString()
  scheduledFor!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
