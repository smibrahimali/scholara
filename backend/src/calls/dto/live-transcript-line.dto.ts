import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LiveTranscriptLineDto {
  @ApiProperty({
    example: 'We should re-upload the transcript before the fee deadline.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
