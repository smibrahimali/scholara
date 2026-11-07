import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UserRole } from '../common/enums';
import { ApplicationsService } from '../applications/applications.service';

@ApiTags('emails')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emails')
export class EmailsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
  ) {
    return this.applicationsService.listEmailsForUser(
      user as JwtPayload,
      studentId,
    );
  }
}
