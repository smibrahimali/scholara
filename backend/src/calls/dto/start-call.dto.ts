import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartCallDto {
  @ApiProperty({
    description:
      'Approved call request id (consultant starts live call from this)',
  })
  @IsUUID()
  callRequestId!: string;
}
