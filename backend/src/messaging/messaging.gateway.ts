import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload';
import { MessagingService } from './messaging.service';

type AuthedSocket = Omit<Socket, 'data'> & {
  data: {
    user?: JwtPayload;
    conversationId?: string;
  };
};

@WebSocketGateway({
  namespace: '/messaging-realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messagingService: MessagingService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.user = payload;
    } catch {
      this.logger.warn(`Messaging socket auth failed: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    client.data.conversationId = undefined;
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const user = client.data.user;
    const conversationId = body?.conversationId?.trim();
    if (!user || !conversationId) {
      return { ok: false, error: 'Unauthorized or missing conversationId' };
    }

    try {
      await this.messagingService.assertCanAccessConversation(
        user,
        conversationId,
      );

      if (
        client.data.conversationId &&
        client.data.conversationId !== conversationId
      ) {
        await client.leave(this.room(client.data.conversationId));
      }

      await client.join(this.room(conversationId));
      client.data.conversationId = conversationId;
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Cannot join conversation';
      return { ok: false, error: message };
    }
  }

  @SubscribeMessage('leave')
  async onLeave(@ConnectedSocket() client: AuthedSocket) {
    try {
      if (client.data.conversationId) {
        await client.leave(this.room(client.data.conversationId));
        client.data.conversationId = undefined;
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not leave conversation' };
    }
  }

  @SubscribeMessage('send_message')
  async onSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string; body?: string },
  ) {
    const user = client.data.user;
    const conversationId =
      body?.conversationId?.trim() ?? client.data.conversationId;
    const text = body?.body ?? '';
    if (!user || !conversationId) {
      return { ok: false, error: 'Unauthorized or missing conversationId' };
    }

    try {
      const message = await this.messagingService.sendMessage(
        user,
        conversationId,
        text,
      );
      this.server.to(this.room(conversationId)).emit('message', message);
      return { ok: true, message };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send message';
      return { ok: false, error: message };
    }
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string; typing?: boolean },
  ) {
    const user = client.data.user;
    const conversationId =
      body?.conversationId?.trim() ?? client.data.conversationId;
    if (!user || !conversationId) {
      return { ok: false };
    }
    if (client.data.conversationId !== conversationId) {
      return { ok: false, error: 'Join the conversation first' };
    }

    client.to(this.room(conversationId)).emit('typing', {
      userId: user.sub,
      fullName: user.fullName,
      typing: Boolean(body?.typing),
    });
    return { ok: true };
  }

  emitMessage(
    conversationId: string,
    message: {
      id: string;
      conversationId: string;
      senderUserId: string;
      senderName: string;
      body: string;
      readAt: Date | string | null;
      createdAt: Date | string;
    },
  ) {
    this.server.to(this.room(conversationId)).emit('message', message);
  }

  private room(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
