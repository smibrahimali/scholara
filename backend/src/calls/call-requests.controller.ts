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
import { CallRequestsService } from './call-requests.service';
import { CreateCallRequestDto } from './dto/create-call-request.dto';
import { RejectCallRequestDto } from './dto/reject-call-request.dto';

@ApiTags('call-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('call-requests')
export class CallRequestsController {
  constructor(private readonly callRequestsService: CallRequestsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.callRequestsService.list(user as JwtPayload, studentId, status);
  }

  @Post()
  @Roles(UserRole.STUDENT)
  create(@CurrentUser() user: unknown, @Body() dto: CreateCallRequestDto) {
    return this.callRequestsService.create(user as JwtPayload, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.STUDENT)
  cancel(@CurrentUser() user: unknown, @Param('id', ParseUUIDPipe) id: string) {
    return this.callRequestsService.cancel(user as JwtPayload, id);
  }

  @Post(':id/approve')
  @Roles(UserRole.CONSULTANT)
  approve(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.callRequestsService.approve(user as JwtPayload, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.CONSULTANT)
  reject(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCallRequestDto,
  ) {
    return this.callRequestsService.reject(user as JwtPayload, id, dto);
  }
}
