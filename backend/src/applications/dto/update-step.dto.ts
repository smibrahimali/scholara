import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApplicationStepStatus } from '../../common/enums';

export class UpdateStepDto {
  @ApiProperty({ enum: ApplicationStepStatus })
  @IsEnum(ApplicationStepStatus)
  status!: ApplicationStepStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
