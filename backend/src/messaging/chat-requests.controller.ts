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
import { ChatRequestsService } from './chat-requests.service';
import { CreateChatRequestDto } from './dto/create-chat-request.dto';
import { RejectChatRequestDto } from './dto/reject-chat-request.dto';

@ApiTags('chat-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat-requests')
export class ChatRequestsController {
  constructor(private readonly chatRequestsService: ChatRequestsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.chatRequestsService.list(user as JwtPayload, studentId, status);
  }

  @Post()
  @Roles(UserRole.STUDENT)
  create(@CurrentUser() user: unknown, @Body() dto: CreateChatRequestDto) {
    return this.chatRequestsService.create(user as JwtPayload, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.STUDENT)
  cancel(@CurrentUser() user: unknown, @Param('id', ParseUUIDPipe) id: string) {
    return this.chatRequestsService.cancel(user as JwtPayload, id);
  }

  @Post(':id/approve')
  @Roles(UserRole.CONSULTANT)
  approve(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatRequestsService.approve(user as JwtPayload, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.CONSULTANT)
  reject(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectChatRequestDto,
  ) {
    return this.chatRequestsService.reject(user as JwtPayload, id, dto);
  }
}
