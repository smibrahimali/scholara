import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyEmailDto {
  @ApiProperty({ example: 'Thanks — I will upload the clearer transcript today.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
