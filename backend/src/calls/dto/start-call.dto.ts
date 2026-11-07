import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartCallDto {
  @ApiProperty({ description: 'Assigned student profile id' })
  @IsUUID()
  studentId!: string;
}
