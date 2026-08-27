"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  Square,
  Upload,
  Languages,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  FileAudio,
  Trash2,
} from "lucide-react";
import { blobToBase64 } from "@/utils/audioEffects";
import { translateBengaliToEnglishFree } from "@/utils/freeTranslate";
import { isSpeechRecognitionSupported, startLiveBengaliRecognition } from "@/utils/speechRecognition";

type AudioSource = "record" | "upload" | null;

export default function TranscribePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSource>(null);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translation, setTranslation] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<"bn" | "en" | null>(null);

  // No-AI fallback state
  const [speechSupported, setSpeechSupported] = useState(false);
  const [browserFallbackTranscript, setBrowserFallbackTranscript] = useState<string>("");
  const [usedTranscriptFallback, setUsedTranscriptFallback] = useState(false);
  const [usedTranslationFallback, setUsedTranslationFallback] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionControllerRef = useRef<ReturnType<typeof startLiveBengaliRecognition>>(null);
  const lastLiveFallbackRef = useRef<string>("");

  // Browser speech-recognition support varies by browser — detect after mount only.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeechSupported(isSpeechRecognitionSupported());
  }, []);

  const resetAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioSource(null);
    setTranscript("");
    setTranslation("");
    setErrorMessage(null);
    setBrowserFallbackTranscript("");
    setUsedTranscriptFallback(false);
    setUsedTranslationFallback(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      lastLiveFallbackRef.current = "";
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const capturedFallback = lastLiveFallbackRef.current;
        resetAudio();
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioSource("record");
        setBrowserFallbackTranscript(capturedFallback);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Run browser speech recognition alongside the recording as a silent,
      // no-AI fallback capture — only possible for a live mic stream.
      recognitionControllerRef.current = startLiveBengaliRecognition();

      recorder.start(200);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setErrorMessage("মাইক্রোফোন অ্যাক্সেস পাওয়া যায়নি। অনুগ্রহ করে পারমিশন দিন।");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recognitionControllerRef.current) {
        lastLiveFallbackRef.current = recognitionControllerRef.current.getTranscript();
        recognitionControllerRef.current.stop();
        recognitionControllerRef.current = null;
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetAudio();
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAudioSource("upload");
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    setErrorMessage(null);
    setTranscript("");
    setTranslation("");
    setUsedTranscriptFallback(false);
    setUsedTranslationFallback(false);

    let geminiErrorMessage = "";

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const res = await fetch("/api/stt/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || "audio/wav",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.transcript) {
        throw new Error(data.error || "অডিও থেকে টেক্সট তৈরি করা যায়নি।");
      }
      setTranscript(data.transcript);
      setIsTranscribing(false);
      return;
    } catch (err) {
      console.error("Transcribe error:", err);
      geminiErrorMessage = err instanceof Error ? err.message : "অডিও থেকে টেক্সট তৈরি করতে ব্যর্থ হয়েছে।";
    }

    // Gemini failed — fall back to the live browser-captured transcript, if any.
    if (audioSource === "record" && browserFallbackTranscript) {
      setTranscript(browserFallbackTranscript);
      setUsedTranscriptFallback(true);
    } else if (audioSource === "upload") {
      setErrorMessage(
        `${geminiErrorMessage} — আপলোড করা ফাইলের জন্য কোনো non-AI বিকল্প নেই (ব্রাউজার স্পিচ রিকগনিশন শুধু লাইভ রেকর্ডিং-এ কাজ করে)। অনুগ্রহ করে মাইক্রোফোনে সরাসরি রেকর্ড করে আবার চেষ্টা করুন।`
      );
    } else {
      setErrorMessage(
        `${geminiErrorMessage}${
          speechSupported
            ? " ব্রাউজার ফলব্যাকও কোনো টেক্সট ধরতে পারেনি — স্পষ্ট করে আবার রেকর্ড করে দেখুন।"
            : " আপনার ব্রাউজার নন-AI ফলব্যাক (স্পিচ রিকগনিশন) সমর্থন করে না — Chrome/Edge ব্যবহার করে দেখুন।"
        }`
      );
    }

    setIsTranscribing(false);
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) return;
    setIsTranslating(true);
    setErrorMessage(null);
    setUsedTranslationFallback(false);

    let geminiErrorMessage = "";

    try {
      const res = await fetch("/api/stt/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.translation) {
        throw new Error(data.error || "অনুবাদ করা যায়নি।");
      }
      setTranslation(data.translation);
      setIsTranslating(false);
      return;
    } catch (err) {
      console.error("Translate error:", err);
      geminiErrorMessage = err instanceof Error ? err.message : "অনুবাদ করতে ব্যর্থ হয়েছে।";
    }

    // Gemini failed — fall back to the free, keyless MyMemory translation API.
    try {
      const freeTranslation = await translateBengaliToEnglishFree(transcript);
      setTranslation(freeTranslation);
      setUsedTranslationFallback(true);
    } catch (fallbackErr) {
      console.error("Free translation fallback error:", fallbackErr);
      setErrorMessage(`${geminiErrorMessage} — ফ্রি ফলব্যাক অনুবাদও ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = (field: "bn" | "en", value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div
      id="transcribe-root-container"
      className="min-h-screen bg-[#090e17] text-slate-100 selection:bg-emerald-500 selection:text-white"
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-96 right-10 w-[400px] h-[300px] bg-teal-500/8 blur-[100px] rounded-full" />
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
        <header id="transcribe-header" className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>ভয়েস জেনারেটরে ফিরে যান</span>
          </Link>

          <div className="text-center space-y-3 pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-xs font-medium shadow-sm">
              <Languages className="h-3.5 w-3.5" />
              <span>বাংলা ভয়েস থেকে টেক্সট ও অনুবাদ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              ভয়েস টু টেক্সট কনভার্টার
            </h1>
            <p className="max-w-xl mx-auto text-sm text-slate-400 leading-relaxed">
              বাংলা কণ্ঠ রেকর্ড বা আপলোড করুন, স্বয়ংক্রিয়ভাবে টেক্সটে রূপান্তরিত হবে। চাইলে ইংরেজিতে অনুবাদও দেখতে পারবেন — উভয় টেক্সট কপি করা যাবে।
            </p>
          </div>
        </header>

        {errorMessage && (
          <div
            id="transcribe-error-banner"
            className="flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-sm shadow-md"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">ত্রুটি:</span> {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 text-xs underline"
            >
              বন্ধ করুন
            </button>
          </div>
        )}

        {/* Audio Input Section */}
        <section
          id="audio-input-section"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm shadow-sm space-y-4"
        >
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Mic className="h-4 w-4 text-emerald-400" />
            ধাপ ১: বাংলা কণ্ঠ রেকর্ড বা আপলোড করুন
          </label>

          <div className="flex flex-wrap items-center gap-3">
            {!isRecording ? (
              <button
                id="start-transcribe-record-btn"
                type="button"
                onClick={handleStartRecording}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-900/80 transition cursor-pointer"
              >
                <Mic className="h-4 w-4 text-red-400" />
                <span>রেকর্ড শুরু করুন</span>
              </button>
            ) : (
              <button
                id="stop-transcribe-record-btn"
                type="button"
                onClick={handleStopRecording}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold animate-pulse shadow-md cursor-pointer"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>রেকর্ডিং বন্ধ করুন ({recordSeconds}s)</span>
              </button>
            )}

            <button
              id="upload-transcribe-audio-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-700 transition cursor-pointer"
            >
              <Upload className="h-4 w-4 text-slate-400" />
              <span>অডিও ফাইল আপলোড (.wav, .mp3)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {speechSupported && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              রেকর্ড করলে ব্রাউজারের নিজস্ব স্পিচ রিকগনিশন পাশাপাশি চালু থাকবে — AI সীমা শেষ হয়ে গেলেও লাইভ রেকর্ডিং থেকে একটি ফলব্যাক টেক্সট পাওয়া যাবে (আপলোড করা ফাইলের জন্য এই সুবিধা কাজ করে না)।
            </p>
          )}

          {audioUrl && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                  <FileAudio className="h-3.5 w-3.5 text-emerald-400" />
                  আপনার অডিও প্রস্তুত
                </span>
                <button
                  id="delete-transcribe-audio-btn"
                  type="button"
                  onClick={resetAudio}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> মুছে ফেলুন
                </button>
              </div>
              <audio src={audioUrl} controls className="h-8 w-full" />

              <button
                id="transcribe-audio-submit-btn"
                type="button"
                disabled={isTranscribing}
                onClick={handleTranscribe}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-semibold text-sm transition-all shadow-lg mt-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>টেক্সটে রূপান্তর হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Languages className="h-4 w-4" />
                    <span>টেক্সটে রূপান্তর করুন</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Bangla Transcript Section */}
        {transcript && (
          <section
            id="transcript-section"
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm shadow-sm space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-emerald-400" />
                ধাপ ২: বাংলা টেক্সট
                {usedTranscriptFallback && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full normal-case">
                    <AlertTriangle className="h-2.5 w-2.5" /> ব্রাউজার ফলব্যাক (AI ছাড়া)
                  </span>
                )}
              </label>
              <button
                id="copy-bn-transcript-btn"
                type="button"
                onClick={() => handleCopy("bn", transcript)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition bg-slate-800/60 px-2.5 py-1 rounded cursor-pointer"
              >
                {copiedField === "bn" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>কপি</span>
                  </>
                )}
              </button>
            </div>

            <div
              id="bn-transcript-text"
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm md:text-base leading-relaxed text-slate-200 whitespace-pre-wrap"
            >
              {transcript}
            </div>

            <button
              id="translate-to-english-btn"
              type="button"
              disabled={isTranslating}
              onClick={handleTranslate}
              className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-xs transition bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                  <span>ইংরেজিতে অনুবাদ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Languages className="h-4 w-4 text-teal-400" />
                  <span>ইংরেজিতে অনুবাদ দেখুন</span>
                </>
              )}
            </button>
          </section>
        )}

        {/* English Translation Section */}
        {translation && (
          <section
            id="translation-section"
            className="rounded-2xl border border-teal-500/30 bg-slate-900/40 p-5 backdrop-blur-sm shadow-sm space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <label className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-teal-400" />
                ধাপ ৩: ইংরেজি অনুবাদ
                {usedTranslationFallback && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full normal-case">
                    <AlertTriangle className="h-2.5 w-2.5" /> ফ্রি ফলব্যাক (AI ছাড়া)
                  </span>
                )}
              </label>
              <button
                id="copy-en-translation-btn"
                type="button"
                onClick={() => handleCopy("en", translation)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition bg-slate-800/60 px-2.5 py-1 rounded cursor-pointer"
              >
                {copiedField === "en" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div
              id="en-translation-text"
              className="rounded-xl border border-teal-500/20 bg-slate-950/60 p-4 text-sm md:text-base leading-relaxed text-slate-200 whitespace-pre-wrap"
            >
              {translation}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
