import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DemoLoginDto {
  @ApiProperty({ example: 'student@scholara.demo' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'demo123' })
  @IsString()
  @MinLength(4)
  password!: string;
}
