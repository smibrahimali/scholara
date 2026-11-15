import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from '../lib/socketUrl';
import { trackSocket } from '../lib/socketRegistry';
import type { DirectMessageItem } from '../types/domain';

type TypingEvent = {
  userId: string;
  fullName: string;
  typing: boolean;
};

export function useMessagingSocket(options: {
  conversationId: string | undefined;
  enabled: boolean;
  onMessage: (message: DirectMessageItem) => void;
}) {
  const { conversationId, enabled, onMessage } = options;
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !conversationId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setPeerTyping(null);
      return;
    }

    const token = localStorage.getItem('scholara_token');
    const socket = io(`${getSocketOrigin()}/messaging-realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    const untrack = trackSocket(socket);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(
        'join',
        { conversationId },
        (ack: { ok?: boolean; error?: string } | undefined) => {
          if (ack && ack.ok === false) {
            setConnected(false);
          }
        },
      );
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setPeerTyping(null);
    });

    socket.on('message', (message: DirectMessageItem) => {
      onMessageRef.current(message);
    });

    socket.on('typing', (event: TypingEvent) => {
      setPeerTyping(event.typing ? event.fullName : null);
    });

    return () => {
      socket.emit('leave');
      untrack();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setPeerTyping(null);
    };
  }, [conversationId, enabled]);

  function sendMessage(body: string) {
    return new Promise<DirectMessageItem>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !conversationId) {
        reject(new Error('Not connected'));
        return;
      }
      socket.emit(
        'send_message',
        { conversationId, body },
        (
          ack:
            | { ok: true; message: DirectMessageItem }
            | { ok: false; error?: string }
            | undefined,
        ) => {
          if (!ack || !ack.ok) {
            const error =
              ack && 'error' in ack ? ack.error : undefined;
            reject(new Error(error ?? 'Send failed'));
            return;
          }
          resolve(ack.message);
        },
      );
    });
  }

  function setTyping(typing: boolean) {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;
    socket.emit('typing', { conversationId, typing });
  }

  return { connected, peerTyping, sendMessage, setTyping };
}
