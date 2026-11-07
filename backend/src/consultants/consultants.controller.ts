import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { ConsultantsService } from './consultants.service';
import { HandoverDto } from './dto/handover.dto';

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

  @Get('consultant/peers')
  @Roles(UserRole.CONSULTANT)
  listPeers(@CurrentUser() user: unknown) {
    return this.consultantsService.listPeers(user as JwtPayload);
  }

  @Post('consultant/handover')
  @Roles(UserRole.CONSULTANT)
  handover(@CurrentUser() user: unknown, @Body() dto: HandoverDto) {
    return this.consultantsService.handover(user as JwtPayload, dto);
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
