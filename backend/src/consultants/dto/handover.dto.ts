import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class HandoverDto {
  @ApiProperty({ description: 'Student currently assigned to the caller' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: 'Consultant profile id receiving the student' })
  @IsUUID()
  toConsultantId!: string;
}
