import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendLiveTranscriptLine,
  transcribeCallAudio,
} from '../services/scholaraApi';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Transcribe local speech using an existing mic stream (owned by useCallMedia). */
export function useLiveCallTranscription(
  callId: string | undefined,
  enabled: boolean,
  stream: MediaStream | null,
) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'speech' | 'whisper' | 'idle'>('idle');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const uploadingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stopAll = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    setListening(false);
    setInterim('');
    setMode('idle');
  }, []);

  useEffect(() => {
    if (!enabled || !callId || !stream) {
      stopAll();
      return;
    }

    let cancelled = false;
    setError(null);

    const SpeechCtor = getSpeechRecognitionCtor();
    if (SpeechCtor) {
      const recognition = new SpeechCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript?.trim();
          if (!text) continue;
          if (result.isFinal) {
            void appendLiveTranscriptLine(callId, text).catch(() => {
              /* keep listening */
            });
            setInterim('');
          } else {
            interimText += `${text} `;
          }
        }
        if (interimText) setInterim(interimText.trim());
      };
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied');
        }
      };
      recognition.onend = () => {
        if (enabledRef.current && recognitionRef.current && !cancelled) {
          try {
            recognition.start();
          } catch {
            /* ignore restart races */
          }
        }
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setMode('speech');
        setListening(true);
      } catch {
        setError('Could not start speech recognition');
      }

      return () => {
        cancelled = true;
        stopAll();
      };
    }

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    recorder.ondataavailable = async (event) => {
      if (!event.data.size || uploadingRef.current || !enabledRef.current) {
        return;
      }
      uploadingRef.current = true;
      try {
        await transcribeCallAudio(callId, event.data);
      } catch {
        /* keep recording */
      } finally {
        uploadingRef.current = false;
      }
    };
    recorder.start(3500);
    setMode('whisper');
    setListening(true);

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [enabled, callId, stream, stopAll]);

  return { listening, interim, error, mode, stopAll };
}
