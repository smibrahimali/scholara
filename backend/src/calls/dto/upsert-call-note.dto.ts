import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertCallNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  summary!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  actionItems!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  universitiesDiscussed!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  followUps!: string;
}
