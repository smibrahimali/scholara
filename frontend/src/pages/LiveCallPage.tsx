import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, Mic, MicOff, PhoneOff, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { PageMotion } from '../components/ivy/PageMotion';
import { ScreenTitle } from '../components/ivy/ScreenTitle';
import { TapButton } from '../components/ivy/TapButton';
import { useAuth } from '../context/AuthContext';
import { useCallMedia } from '../hooks/useCallMedia';
import { useLiveCallTranscription } from '../hooks/useLiveCallTranscription';
import { useWebRtcCall } from '../hooks/useWebRtcCall';
import { formatDisplayDate } from '../lib/statusMaps';
import { endCall, fetchCall } from '../services/scholaraApi';

export function LiveCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const callQuery = useQuery({
    queryKey: ['call', callId],
    queryFn: () => fetchCall(callId!),
    enabled: Boolean(callId),
    refetchInterval: (query) =>
      query.state.data?.endedAt ? false : 1500,
  });

  const call = callQuery.data;
  const isOpen = Boolean(call && !call.endedAt);
  const isConsultant = user?.role === 'CONSULTANT';
  const canSpeak =
    isOpen && (user?.role === 'STUDENT' || user?.role === 'CONSULTANT');

  const historyPath = call
    ? isConsultant
      ? `/app/students/${call.studentId}/calls`
      : '/app/consultant'
    : '/app';

  const {
    stream,
    error: mediaError,
    stop: stopMedia,
  } = useCallMedia(canSpeak);

  const { listening, interim, error: sttError, mode, stopAll: stopStt } =
    useLiveCallTranscription(callId, canSpeak, stream);

  const {
    status: rtcStatus,
    peerName,
    error: rtcError,
  } = useWebRtcCall({
    callId,
    enabled: canSpeak && Boolean(stream),
    localStream: stream,
  });

  const leaveCall = () => {
    stopStt();
    stopMedia();
    navigate(historyPath);
  };

  const endMutation = useMutation({
    mutationFn: () => endCall(callId!),
    onSuccess: () => {
      stopStt();
      stopMedia();
      toast.success('Call ended — transcript saved');
      void queryClient.invalidateQueries({ queryKey: ['call', callId] });
      void queryClient.invalidateQueries({ queryKey: ['calls'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(historyPath);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not end call';
      toast.error(message);
    },
  });

  if (callQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Joining live call…</p>
    );
  }

  if (callQuery.error || !call) {
    return (
      <PageMotion>
        <ScreenTitle eyebrow="Live call" title="Unavailable" />
        <p className="text-sm text-destructive">
          Could not load this call. It may have ended or you lack access.
        </p>
        <TapButton
          className="mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          onClick={() => navigate('/app')}
        >
          Back home
        </TapButton>
      </PageMotion>
    );
  }

  const otherParty =
    user?.role === 'CONSULTANT'
      ? call.student?.user.fullName
      : call.consultant?.user.fullName;

  const linkLabel =
    rtcStatus === 'connected'
      ? peerName
        ? `Connected with ${peerName}`
        : 'Audio connected'
      : rtcStatus === 'waiting'
        ? 'Waiting for the other person to join…'
        : rtcStatus === 'connecting'
          ? 'Connecting audio…'
          : rtcStatus === 'error'
            ? 'Audio connection issue'
            : 'Audio idle';

  return (
    <PageMotion>
      <div className="flex min-h-full flex-col">
        <div className="flex-1">
          <ScreenTitle
            eyebrow={isOpen ? 'Live 1:1 call' : 'Call ended'}
            title={otherParty ? `Call with ${otherParty}` : 'Live call'}
          />

          <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  rtcStatus === 'connected'
                    ? 'bg-success/15 text-success'
                    : listening
                      ? 'bg-gold/20 text-gold-ink'
                      : 'bg-secondary text-muted-foreground'
                }`}
              >
                {rtcStatus === 'connected' ? (
                  <Radio className="h-5 w-5 animate-pulse" />
                ) : listening ? (
                  <Mic className="h-5 w-5 animate-pulse" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{linkLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Started {formatDisplayDate(call.startedAt)}
                  {mode === 'speech'
                    ? ' · Live transcript on'
                    : mode === 'whisper'
                      ? ' · Whisper transcript on'
                      : ''}
                </p>
                {mediaError || sttError || rtcError ? (
                  <p className="mt-1 text-xs text-destructive">
                    {mediaError || sttError || rtcError}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              This is a real browser audio call (WebRTC). Both of you should hear
              each other; speech is also transcribed for handover.
            </p>

            {user?.role === 'GUARDIAN' ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Guardians can watch the transcript but cannot join the audio
                call.
              </p>
            ) : null}

            {isConsultant && isOpen ? (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                You control the call. Use End call when finished.
              </p>
            ) : null}

            {!isConsultant && isOpen ? (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                Leave anytime. Only the consultant can end the call for
                everyone.
              </p>
            ) : null}
          </div>

          <h2 className="mb-2 font-serif text-xl font-semibold">
            Live transcript
          </h2>
          <div className="min-h-48 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {call.transcript?.trim() ||
                (isOpen
                  ? 'Waiting for speech… talk into your microphone.'
                  : 'No transcript was captured.')}
            </p>
            {interim ? (
              <p className="mt-3 border-t border-border pt-3 text-sm italic text-muted-foreground">
                {user?.fullName}: {interim}
              </p>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-30 -mx-5 mt-6 border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <div className="flex flex-col gap-2">
            {isOpen && isConsultant ? (
              <TapButton
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-3.5 text-sm font-semibold text-white shadow-soft"
                onClick={() => endMutation.mutate()}
                disabled={endMutation.isPending}
              >
                <PhoneOff className="h-4 w-4" />
                {endMutation.isPending
                  ? 'Ending…'
                  : 'End call & save transcript'}
              </TapButton>
            ) : null}

            {isOpen && !isConsultant ? (
              <TapButton
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3.5 text-sm font-semibold"
                onClick={leaveCall}
              >
                <LogOut className="h-4 w-4" />
                Leave call
              </TapButton>
            ) : null}

            {!isOpen ? (
              <TapButton
                className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
                onClick={() => navigate(historyPath)}
              >
                View call history
              </TapButton>
            ) : null}

            {isOpen && isConsultant ? (
              <TapButton
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground"
                onClick={leaveCall}
              >
                Leave without ending
              </TapButton>
            ) : null}
          </div>
        </div>
      </div>
    </PageMotion>
  );
}
