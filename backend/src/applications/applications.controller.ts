import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { ApplicationsService } from './applications.service';
import { UpdateStepDto } from './dto/update-step.dto';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
  ) {
    return this.applicationsService.listForUser(
      user as JwtPayload,
      studentId,
    );
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  detail(@CurrentUser() user: unknown, @Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.getDetail(user as JwtPayload, id);
  }

  @Patch(':id/steps/:n')
  @Roles(UserRole.CONSULTANT)
  updateStep(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('n', ParseIntPipe) stepNumber: number,
    @Body() dto: UpdateStepDto,
  ) {
    return this.applicationsService.updateStep(
      user as JwtPayload,
      id,
      stepNumber,
      dto,
    );
  }
}
