import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UserRole } from '../common/enums';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

class ChatContextQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(
    @CurrentUser() user: unknown,
    @Query() query: ChatContextQueryDto,
  ) {
    return this.chatService.listMessages(
      user as JwtPayload,
      query.studentId,
    );
  }

  @Post('messages')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  send(@CurrentUser() user: unknown, @Body() dto: SendChatMessageDto) {
    return this.chatService.sendMessage(user as JwtPayload, dto);
  }

  @Delete('messages')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  clear(
    @CurrentUser() user: unknown,
    @Query() query: ChatContextQueryDto,
  ) {
    return this.chatService.clearMessages(
      user as JwtPayload,
      query.studentId,
    );
  }
}
