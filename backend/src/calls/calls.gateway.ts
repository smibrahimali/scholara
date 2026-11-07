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
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth/jwt-payload';
import { CallsService } from './calls.service';

type AuthedSocket = Socket & {
  data: {
    user?: JwtPayload;
    callId?: string;
  };
};

@WebSocketGateway({
  namespace: '/calls-realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CallsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CallsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly callsService: CallsService,
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
      this.logger.warn(`Socket auth failed: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const callId = client.data.callId;
    const user = client.data.user;
    if (callId && user) {
      client.to(this.room(callId)).emit('peer-left', {
        userId: user.sub,
        fullName: user.fullName,
      });
    }
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { callId?: string },
  ) {
    const user = client.data.user;
    const callId = body?.callId?.trim();
    if (!user || !callId) {
      return { ok: false, error: 'Unauthorized or missing callId' };
    }

    try {
      await this.callsService.assertCanJoinLiveCall(user, callId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Cannot join this call';
      return { ok: false, error: message };
    }

    const room = this.room(callId);
    const existing = await this.server.in(room).fetchSockets();
    if (existing.length >= 2) {
      return { ok: false, error: 'Call room is full (2 participants max)' };
    }

    if (client.data.callId && client.data.callId !== callId) {
      await client.leave(this.room(client.data.callId));
    }

    await client.join(room);
    client.data.callId = callId;

    const peerCount = existing.length + 1;
    if (existing.length > 0) {
      client.to(room).emit('peer-joined', {
        userId: user.sub,
        fullName: user.fullName,
        role: user.role,
      });
    }

    return {
      ok: true,
      peerCount,
      /** Existing peer should create the WebRTC offer when a new peer joins. */
      createOffer: false,
    };
  }

  @SubscribeMessage('leave')
  async onLeave(@ConnectedSocket() client: AuthedSocket) {
    const callId = client.data.callId;
    const user = client.data.user;
    if (callId) {
      const room = this.room(callId);
      if (user) {
        client.to(room).emit('peer-left', {
          userId: user.sub,
          fullName: user.fullName,
        });
      }
      await client.leave(room);
      client.data.callId = undefined;
    }
    return { ok: true };
  }

  @SubscribeMessage('signal')
  async onSignal(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: {
      callId?: string;
      type?: 'offer' | 'answer' | 'ice';
      payload?: unknown;
    },
  ) {
    const user = client.data.user;
    const callId = body?.callId ?? client.data.callId;
    if (!user || !callId || !body?.type || body.payload === undefined) {
      return { ok: false, error: 'Invalid signal' };
    }
    if (client.data.callId !== callId) {
      return { ok: false, error: 'Join the call before signaling' };
    }

    client.to(this.room(callId)).emit('signal', {
      type: body.type,
      payload: body.payload,
      fromUserId: user.sub,
      fromName: user.fullName,
    });
    return { ok: true };
  }

  private room(callId: string) {
    return `call:${callId}`;
  }
}
