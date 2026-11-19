import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UserRole } from '../common/enums';
import { ApplicationsService } from '../applications/applications.service';
import { ReplyEmailDto } from './dto/reply-email.dto';

@ApiTags('emails')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emails')
export class EmailsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(@CurrentUser() user: unknown, @Query('studentId') studentId?: string) {
    return this.applicationsService.listEmailsForUser(
      user as JwtPayload,
      studentId,
    );
  }

  @Post(':id/reply')
  @Roles(UserRole.STUDENT)
  reply(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyEmailDto,
  ) {
    return this.applicationsService.replyToEmail(
      user as JwtPayload,
      id,
      dto,
    );
  }
}
