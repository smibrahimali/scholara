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
import { UserRole } from '../common/enums';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { StartChatSessionDto } from './dto/start-chat-session.dto';

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Get('sessions/open')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  openSession(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
  ) {
    return this.messagingService.getOpenSession(user as JwtPayload, studentId);
  }

  @Post('sessions')
  @Roles(UserRole.CONSULTANT)
  startSession(@CurrentUser() user: unknown, @Body() dto: StartChatSessionDto) {
    return this.messagingService.startSession(
      user as JwtPayload,
      dto.chatRequestId,
    );
  }

  @Post('sessions/:id/end')
  @Roles(UserRole.CONSULTANT)
  endSession(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messagingService.endSession(user as JwtPayload, id);
  }

  @Get('conversations')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(@CurrentUser() user: unknown) {
    return this.messagingService.listConversations(user as JwtPayload);
  }

  @Get('conversation')
  @Roles(UserRole.STUDENT, UserRole.CONSULTANT)
  getOrCreate(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
  ) {
    return this.messagingService.getOrCreateConversation(
      user as JwtPayload,
      studentId,
    );
  }

  @Get('conversation/:id/messages')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  messages(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    return this.messagingService.listMessages(
      user as JwtPayload,
      id,
      Number.isFinite(parsed) ? parsed : 50,
      before,
    );
  }

  @Post('conversation/:id/messages')
  @Roles(UserRole.STUDENT, UserRole.CONSULTANT)
  async send(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    const message = await this.messagingService.sendMessage(
      user as JwtPayload,
      id,
      dto.body,
    );
    this.messagingGateway.emitMessage(id, message);
    return message;
  }

  @Post('conversation/:id/read')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  markRead(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messagingService.markRead(user as JwtPayload, id);
  }
}
