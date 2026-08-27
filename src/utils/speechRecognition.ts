/**
 * Thin wrapper around the browser's native SpeechRecognition API, used as a
 * no-AI fallback for live-recorded audio (it cannot transcribe an already
 * recorded/uploaded audio file — only a live microphone stream).
 */

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Starts live Bengali speech recognition. Returns a controller with a
 * `stop()` that resolves the accumulated final transcript so far.
 */
export function startLiveBengaliRecognition(): {
  getTranscript: () => string;
  stop: () => void;
} | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "bn-BD";
  recognition.continuous = true;
  recognition.interimResults = false;

  let finalTranscript = "";

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += (finalTranscript ? " " : "") + result[0].transcript;
      }
    }
  };
  recognition.onerror = () => {
    // Swallow errors — this is a best-effort silent fallback capture.
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    getTranscript: () => finalTranscript.trim(),
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    },
  };
}
