import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StartChatSessionDto {
  @ApiProperty({
    description: 'Approved chat request id',
  })
  @IsUUID()
  chatRequestId!: string;
}
