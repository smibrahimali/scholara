import { useCallback, useEffect, useRef, useState } from 'react';

export function useCallMedia(enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = media;
        setStream(media);
        setError(null);
      } catch {
        setError('Could not access microphone. Allow mic permission and retry.');
        setStream(null);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, stop]);

  return { stream, error, stop };
}
