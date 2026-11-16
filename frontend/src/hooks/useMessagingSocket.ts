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
      if (!socket || !conversationId || !socket.connected) {
        reject(new Error('Not connected'));
        return;
      }

      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.off('disconnect', onDisconnect);
        fn();
      };

      const onDisconnect = () => {
        settle(() => reject(new Error('Disconnected before send ack')));
      };

      const timeout = setTimeout(() => {
        settle(() => reject(new Error('Send timed out')));
      }, 12_000);

      socket.once('disconnect', onDisconnect);
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
            settle(() => reject(new Error(error ?? 'Send failed')));
            return;
          }
          settle(() => resolve(ack.message));
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
