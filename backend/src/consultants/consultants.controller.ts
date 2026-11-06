import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { ConsultantsService } from './consultants.service';

@ApiTags('consultant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ConsultantsController {
  constructor(private readonly consultantsService: ConsultantsService) {}

  @Get('consultant/students')
  @Roles(UserRole.CONSULTANT)
  listStudents(@CurrentUser() user: unknown) {
    return this.consultantsService.listAssignedStudents(user as JwtPayload);
  }

  @Get('call-notes')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  callNotes(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
  ) {
    const payload = user as JwtPayload;
    const id =
      studentId ?? payload.studentProfileId ?? payload.linkedStudentId;
    if (!id) {
      return [];
    }
    return this.consultantsService.listCallNotes(payload, id);
  }
}
