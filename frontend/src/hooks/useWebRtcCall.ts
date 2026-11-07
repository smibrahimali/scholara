import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from '../lib/socketUrl';

type SignalMessage = {
  type: 'offer' | 'answer' | 'ice';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  fromUserId: string;
  fromName: string;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRtcCall(options: {
  callId: string | undefined;
  enabled: boolean;
  localStream: MediaStream | null;
}) {
  const { callId, enabled, localStream } = options;
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'waiting' | 'connected' | 'error'
  >('idle');
  const [peerName, setPeerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const makingOfferRef = useRef(false);

  useEffect(() => {
    if (!enabled || !callId || !localStream) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      setStatus('idle');
      setPeerName(null);
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    setError(null);

    const token = localStorage.getItem('scholara_token');
    const socket = io(`${getSocketOrigin()}/calls-realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    for (const track of localStream.getAudioTracks()) {
      pc.addTrack(track, localStream);
    }

    pc.ontrack = (event) => {
      const remoteStream =
        event.streams[0] ?? new MediaStream([event.track]);
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => {
        /* autoplay policies — user already interacted by joining */
      });
      setStatus('connected');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', {
          callId,
          type: 'ice',
          payload: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('connected');
      } else if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        setStatus((prev) => (prev === 'connected' ? 'waiting' : prev));
      }
    };

    const createOffer = async () => {
      if (makingOfferRef.current || cancelled) return;
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        socket.emit('signal', {
          callId,
          type: 'offer',
          payload: pc.localDescription,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not create WebRTC offer',
        );
        setStatus('error');
      } finally {
        makingOfferRef.current = false;
      }
    };

    socket.on('connect', () => {
      socket.emit(
        'join',
        { callId },
        (response: { ok?: boolean; error?: string; peerCount?: number }) => {
          if (cancelled) return;
          if (!response?.ok) {
            setError(response?.error ?? 'Could not join call room');
            setStatus('error');
            return;
          }
          setStatus(
            (response.peerCount ?? 1) > 1 ? 'connecting' : 'waiting',
          );
        },
      );
    });

    socket.on(
      'peer-joined',
      (payload: { userId: string; fullName: string; role: string }) => {
        setPeerName(payload.fullName);
        setStatus('connecting');
        void createOffer();
      },
    );

    socket.on('peer-left', () => {
      setPeerName(null);
      setStatus('waiting');
    });

    socket.on('signal', async (message: SignalMessage) => {
      try {
        if (message.type === 'offer') {
          setPeerName(message.fromName);
          await pc.setRemoteDescription(
            message.payload as RTCSessionDescriptionInit,
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', {
            callId,
            type: 'answer',
            payload: pc.localDescription,
          });
        } else if (message.type === 'answer') {
          await pc.setRemoteDescription(
            message.payload as RTCSessionDescriptionInit,
          );
          setStatus('connected');
        } else if (message.type === 'ice') {
          try {
            await pc.addIceCandidate(
              message.payload as RTCIceCandidateInit,
            );
          } catch {
            /* candidate may arrive before remote description */
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'WebRTC signaling failed',
        );
        setStatus('error');
      }
    });

    socket.on('connect_error', () => {
      setError('Could not connect to call signaling server');
      setStatus('error');
    });

    return () => {
      cancelled = true;
      socket.emit('leave');
      socket.disconnect();
      socketRef.current = null;
      pc.close();
      pcRef.current = null;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current = null;
      }
    };
  }, [enabled, callId, localStream]);

  return { status, peerName, error };
}
