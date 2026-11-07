import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UserRole } from '../common/enums';
import { CallsService } from './calls.service';
import { StartCallDto } from './dto/start-call.dto';
import { UpdateTranscriptDto } from './dto/update-transcript.dto';
import { UpsertCallNoteDto } from './dto/upsert-call-note.dto';
import { LiveTranscriptLineDto } from './dto/live-transcript-line.dto';

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  list(
    @CurrentUser() user: unknown,
    @Query('studentId') studentId?: string,
  ) {
    return this.callsService.listForUser(user as JwtPayload, studentId);
  }

  @Get(':id')
  @Roles(UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CONSULTANT)
  getOne(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.callsService.getById(user as JwtPayload, id);
  }

  @Post()
  @Roles(UserRole.CONSULTANT)
  start(@CurrentUser() user: unknown, @Body() dto: StartCallDto) {
    return this.callsService.start(user as JwtPayload, dto);
  }

  @Patch(':id/transcript')
  @Roles(UserRole.CONSULTANT)
  updateTranscript(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTranscriptDto,
  ) {
    return this.callsService.updateTranscript(user as JwtPayload, id, dto);
  }

  @Post(':id/live-line')
  @Roles(UserRole.STUDENT, UserRole.CONSULTANT)
  liveLine(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LiveTranscriptLineDto,
  ) {
    return this.callsService.appendLiveLine(user as JwtPayload, id, dto);
  }

  @Post(':id/transcribe')
  @Roles(UserRole.STUDENT, UserRole.CONSULTANT)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  transcribe(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.callsService.transcribeLiveAudio(user as JwtPayload, id, file);
  }

  @Post(':id/end')
  @Roles(UserRole.CONSULTANT)
  end(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.callsService.end(user as JwtPayload, id);
  }

  @Put(':id/note')
  @Roles(UserRole.CONSULTANT)
  upsertNote(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCallNoteDto,
  ) {
    return this.callsService.upsertNote(user as JwtPayload, id, dto);
  }
}
