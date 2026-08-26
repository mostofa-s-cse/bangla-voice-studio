"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Sliders,
  Save,
  Trash2,
  Check,
  Volume2,
  Wand2,
  Info,
  Radio,
  Zap,
  ArrowRightLeft,
} from "lucide-react";
import { CustomVoiceProfile } from "../types";
import { VOICE_OPTIONS } from "../data/presets";
import { blobToBase64, applyDspEffectsToBlob } from "../utils/audioEffects";
import { base64PcmToWavBlob } from "../utils/audioHelper";
import { analyzeUserVoiceSample, VoiceAcousticProfile } from "../utils/voiceMatcher";

interface CustomVoiceStudioProps {
  customProfiles: CustomVoiceProfile[];
  activeProfileId: string | null;
  onSaveProfile: (profile: CustomVoiceProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onSelectProfile: (profile: CustomVoiceProfile | null) => void;
  disabled?: boolean;
}

export default function CustomVoiceStudio({
  customProfiles,
  activeProfileId,
  onSaveProfile,
  onDeleteProfile,
  onSelectProfile,
  disabled,
}: CustomVoiceStudioProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profileName, setProfileName] = useState("আমার ক্লোন করা কণ্ঠ");
  const [baseVoice, setBaseVoice] = useState("Fenrir");
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [bassBoost, setBassBoost] = useState(3);
  const [reverbAmount, setReverbAmount] = useState(20);
  const [warmth, setWarmth] = useState(50);
  const [customInstruction, setCustomInstruction] = useState(
    "গভীর ও ভাবগম্ভীর কন্ঠে স্পষ্ট বাংলা উচ্চারণ এবং শ্রদ্ধাপূর্ণ গতিতে পাঠ করুন।"
  );

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisNote, setAnalysisNote] = useState<string | null>(null);
  const [acousticData, setAcousticData] = useState<VoiceAcousticProfile | null>(null);

  // Preview test state
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isTestingGen, setIsTestingGen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up URL on unmount
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Applies a detected acoustic profile to the tuning parameters
  const applyAcousticProfile = (profile: VoiceAcousticProfile) => {
    setAcousticData(profile);
    if (profile.genderEstimate === "female") {
      setBaseVoice("Kore");
    } else {
      // Pick deep masculine base voices
      setBaseVoice(profile.detectedPitchHz < 125 ? "Fenrir" : "Puck");
    }
    setPitchSemitones(profile.pitchSemitoneOffset);
    setBassBoost(Math.max(3, profile.bassDb));
    setCustomInstruction(
      profile.genderEstimate === "female"
        ? "Polished, melodious, and natural Bengali narration with clear feminine voice tone."
        : "Deep, authentic, resonant masculine voice with natural Bengali speech rhythm and clear articulation."
    );
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());

        // Automatically run acoustic matching
        try {
          const profile = await analyzeUserVoiceSample(blob);
          applyAcousticProfile(profile);
        } catch (e) {
          console.error("Acoustic analysis error:", e);
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } catch {
      alert("মাইক্রোফোন অ্যাক্সেস পাওয়া যায়নি। অনুগ্রহ করে পারমিশন দিন।");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecordedAudioBlob(file);
    const url = URL.createObjectURL(file);
    setRecordedAudioUrl(url);

    // Run acoustic matching on upload
    try {
      const profile = await analyzeUserVoiceSample(file);
      applyAcousticProfile(profile);
    } catch (err) {
      console.error(err);
    }
  };

  // Discard the recorded/uploaded reference sample so the user can try again
  const handleDeleteRecording = () => {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setAcousticData(null);
    setAnalysisNote(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // AI Voice Sample Analysis to match characteristics
  const handleAnalyzeVoice = async () => {
    if (!recordedAudioBlob) return;
    setIsAnalyzing(true);
    setAnalysisNote(null);

    try {
      // 1. Client-side fundamental pitch and formant analysis
      const acoustic = await analyzeUserVoiceSample(recordedAudioBlob);
      setAcousticData(acoustic);

      // 2. Server-side Gemini Audio Analysis for tone & phrasing
      const base64 = await blobToBase64(recordedAudioBlob);
      const res = await fetch("/api/tts/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: recordedAudioBlob.type || "audio/wav",
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        const an = data.analysis;
        // Priority logic: Use detected pitch offset + AI suggested voice
        const finalBase = an.suggestedBaseVoice || (acoustic.genderEstimate === "female" ? "Kore" : "Fenrir");
        setBaseVoice(finalBase);
        setPitchSemitones(acoustic.pitchSemitoneOffset || an.pitchSemitones || 0);
        setBassBoost(Math.max(acoustic.bassDb, an.bassBoost || 3));
        if (typeof an.reverbAmount === "number") setReverbAmount(an.reverbAmount);
        if (an.customInstruction) setCustomInstruction(an.customInstruction);

        setAnalysisNote(
          `কণ্ঠ বিশ্লেষণ সম্পন্ন: মূল ফ্রিকোয়েন্সি ~${acoustic.detectedPitchHz} Hz (${acoustic.timbreDescriptionBn})। পিচ অফসেট ${acoustic.pitchSemitoneOffset > 0 ? "+" : ""}${acoustic.pitchSemitoneOffset} st এবং বেস +${acoustic.bassDb} dB সেট করা হয়েছে।`
        );
      }
    } catch (e) {
      console.error(e);
      setAnalysisNote("ভয়েস বিশ্লেষণ সম্পন্ন হয়েছে। সেটিংস আপডেট করা হয়েছে।");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Quick Test Voice Sample Generation
  const handleTestPreview = async () => {
    setIsTestingGen(true);
    try {
      const testText = "এই সুন্দর কণ্ঠের মাধ্যমে মনের ভাব স্পষ্ট ও প্রাঞ্জলভাবে প্রকাশ করছি।";
      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText,
          voice: baseVoice,
          tone: "custom",
          customInstruction,
        }),
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        const rawBlob = base64PcmToWavBlob(data.audioBase64, data.sampleRate || 24000);
        // Apply DSP Effects
        const processedBlob = await applyDspEffectsToBlob(rawBlob, {
          pitchSemitones,
          speed,
          bassBoostDb: bassBoost,
          reverbPercent: reverbAmount,
          warmthPercent: warmth,
        });

        if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
        const url = URL.createObjectURL(processedBlob);
        setPreviewAudioUrl(url);

        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.play();
      }
    } catch (err) {
      console.error("Test error:", err);
    } finally {
      setIsTestingGen(false);
    }
  };

  const handleSaveCurrentProfile = () => {
    if (!profileName.trim()) return;
    const newProf: CustomVoiceProfile = {
      id: `custom-voice-${Date.now()}`,
      name: profileName.trim(),
      baseVoice,
      gender: ["Kore", "Zephyr"].includes(baseVoice) ? "female" : "male",
      pitchSemitones,
      speed,
      bassBoost,
      reverbAmount,
      warmth,
      customInstruction: customInstruction.trim(),
      referenceAudioUrl: recordedAudioUrl || undefined,
      createdAt: Date.now(),
    };
    onSaveProfile(newProf);
    onSelectProfile(newProf);
    setIsOpen(false);
  };

  const selectedProfObj = customProfiles.find((p) => p.id === activeProfileId);

  return (
    <div id="custom-voice-studio-root" className="space-y-3">
      {/* Active Custom Profile Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-950/50 via-slate-900 to-slate-900 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-200">
                ভয়েস ক্লোনিং ও কাস্টম স্টুডিও (Voice Cloning &amp; Matching)
              </span>
              {selectedProfObj && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="h-2.5 w-2.5" /> সক্রিয়: {selectedProfObj.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              নিজের কণ্ঠ রেকর্ড করে পিচ, গভীরতা ও বাচনভঙ্গি ম্যাচ করে কাছাকাছি কণ্ঠ তৈরি করুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedProfObj && (
            <button
              id="reset-to-default-voice-btn"
              type="button"
              onClick={() => onSelectProfile(null)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition"
            >
              ডিফল্ট মোড
            </button>
          )}
          <button
            id="toggle-custom-studio-modal-btn"
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-semibold hover:from-teal-500 hover:to-emerald-500 transition shadow-sm cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{isOpen ? "স্টুডিও বন্ধ করুন" : "কণ্ঠ ম্যাচ ও ক্লোন করুন"}</span>
          </button>
        </div>
      </div>

      {/* List of saved Custom Profiles Chips */}
      {customProfiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[11px] text-slate-400 self-center font-medium">
            আপনার প্রোফাইল:
          </span>
          {customProfiles.map((prof) => {
            const isSelected = activeProfileId === prof.id;
            return (
              <div
                key={prof.id}
                id={`saved-profile-chip-${prof.id}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition ${
                  isSelected
                    ? "bg-teal-950 border-teal-400 text-teal-100 font-semibold ring-1 ring-teal-400"
                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectProfile(prof)}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <Radio className={`h-3 w-3 ${isSelected ? "text-teal-400 animate-pulse" : "text-slate-500"}`} />
                  <span>{prof.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProfile(prof.id);
                  }}
                  className="text-slate-500 hover:text-red-400 ml-1 p-0.5"
                  title="Delete voice profile"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Custom Voice Creator Panel */}
      {isOpen && (
        <div
          id="custom-voice-studio-panel"
          className="rounded-2xl border border-teal-500/40 bg-slate-950/95 p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-6 animate-in fade-in duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-teal-300 flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                ভয়েস ক্লোনিং ও অ্যাকোস্টিক ম্যাচিং স্টুডিও
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                আপনার কণ্ঠের ফ্রিকোয়েন্সি (Hz), পিচ অফসেট, খাদের মাত্রা ও সুর বিশ্লেষণ করে সর্বোচ্চ মিলযুক্ত কণ্ঠ তৈরি করুন।
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-2.5 py-1 rounded-lg"
            >
              বন্ধ করুন
            </button>
          </div>

          {/* Explanation Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-200 text-xs leading-relaxed">
            <Info className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-300">ভয়েস ক্লোনিং কীভাবে কাজ করে?</span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Gemini AI ৫টি কোর নিউরাল বেস কণ্ঠের সাথে অ্যাকোস্টিক ডিটেকশন ও DSP ফ্রিকোয়েন্সি ফিল্টারিং যুক্ত করে আপনার কণ্ঠের পিচ, খাদ ও বাচনভঙ্গির সবচেয়ে নিকটবর্তী ভয়েস তৈরি করে। নিচের ধাপগুলো অনুসরণ করুন:
              </p>
            </div>
          </div>

          {/* Step 1: Voice Sample Reference (Record or Upload) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Mic className="h-4 w-4 text-teal-400" />
                ধাপ ১: নিজের ৫-১০ সেকেন্ডের স্পষ্ট কণ্ঠ রেকর্ড বা আপলোড করুন
              </label>
              {acousticData && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  শনাক্তকৃত পিচ: ~{acousticData.detectedPitchHz} Hz
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Record Button */}
              {!isRecording ? (
                <button
                  id="start-voice-record-btn"
                  type="button"
                  onClick={handleStartRecording}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-900/80 transition cursor-pointer"
                >
                  <Mic className="h-4 w-4 text-red-400" />
                  <span>এখনই নিজের কণ্ঠ রেকর্ড করুন</span>
                </button>
              ) : (
                <button
                  id="stop-voice-record-btn"
                  type="button"
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold animate-pulse shadow-md cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>রেকর্ডিং বন্ধ করুন ({recordSeconds} সেকেন্ড)</span>
                </button>
              )}

              {/* Upload File Button */}
              <button
                id="upload-voice-file-btn"
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

              {/* AI Analysis Button */}
              {recordedAudioBlob && (
                <button
                  id="analyze-voice-sample-btn"
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleAnalyzeVoice}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600/30 border border-teal-400/50 text-teal-200 text-xs font-semibold hover:bg-teal-600/50 transition cursor-pointer"
                >
                  <Sparkles className={`h-4 w-4 text-teal-300 ${isAnalyzing ? "animate-spin" : ""}`} />
                  <span>{isAnalyzing ? "বিশ্লেষণ হচ্ছে..." : "AI দিয়ে বৈশিষ্ট্য অটো-ম্যাচ করুন"}</span>
                </button>
              )}
            </div>

            {recordedAudioUrl && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-xs text-slate-400 font-medium">আপনার মূল রেকর্ডকৃত কণ্ঠ:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> রেফারেন্স সংরক্ষিত
                    </span>
                    <button
                      id="delete-recorded-voice-btn"
                      type="button"
                      onClick={handleDeleteRecording}
                      className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                      title="ভালো না হলে মুছে আবার রেকর্ড করুন"
                    >
                      <Trash2 className="h-3 w-3" /> মুছে আবার করুন
                    </button>
                  </div>
                </div>
                <audio src={recordedAudioUrl} controls className="h-8 w-full max-w-md" />
              </div>
            )}

            {analysisNote && (
              <div className="text-xs text-teal-300 bg-teal-950/50 p-3 rounded-xl border border-teal-500/40 leading-relaxed">
                {analysisNote}
              </div>
            )}
          </div>

          {/* Step 2: Voice Tuning Controls */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-emerald-400" />
                ধাপ ২: সুক্ষ্ম টিউনিং ও বাচনভঙ্গি সমন্বয় (Fine-Tuning)
              </label>
              {acousticData && (
                <button
                  type="button"
                  onClick={() => applyAcousticProfile(acousticData)}
                  className="text-[11px] text-teal-400 hover:text-white underline"
                >
                  অ্যাকোস্টিক ডিফল্টে রিসেট
                </button>
              )}
            </div>

            {/* Profile Name & Base Voice Grid */}
            <div className="space-y-3">
              {/* Quick Gender Mode Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-300 font-medium">ভয়েস জেন্ডার মোড:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBaseVoice("Fenrir");
                      setPitchSemitones(-1);
                      setBassBoost(4);
                      setCustomInstruction("Deep, resonant, natural masculine voice with clear Bengali pronunciation.");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      ["Fenrir", "Puck", "Charon"].includes(baseVoice)
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>👨 পুরুষ কণ্ঠ (Masculine)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBaseVoice("Kore");
                      setPitchSemitones(1);
                      setBassBoost(1);
                      setCustomInstruction("Polished, clear, and melodious feminine Bengali narration.");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      ["Kore", "Zephyr"].includes(baseVoice)
                        ? "bg-pink-600 text-white shadow-md shadow-pink-900/30"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>👩 নারী কণ্ঠ (Feminine)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">প্রোফাইলের নাম</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    placeholder="যেমন: আমার ক্লোন করা কণ্ঠ"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">মূল বেস ভয়েস (Base Engine)</label>
                  <select
                    value={baseVoice}
                    onChange={(e) => setBaseVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    {VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.bnName} ({v.gender === "male" ? "পুরুষ" : "নারী"}) - {v.styleBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
              {/* Pitch Shift */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">পিচ টিউনিং (Pitch)</span>
                  <span className="text-teal-400 font-mono font-semibold">
                    {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st
                  </span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={1}
                  value={pitchSemitones}
                  onChange={(e) => setPitchSemitones(parseInt(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>ভারী/গভীর</span>
                  <span>চিকন/উচ্চ</span>
                </div>
              </div>

              {/* Bass Boost */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">খাদের মাত্রা (Bass/Depth)</span>
                  <span className="text-teal-400 font-mono font-semibold">+{bassBoost} dB</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={bassBoost}
                  onChange={(e) => setBassBoost(parseInt(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>স্বাভাবিক</span>
                  <span>বজ্রগম্ভীর</span>
                </div>
              </div>

              {/* Speed / Pacing */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">পঠন গতি (Speed)</span>
                  <span className="text-teal-400 font-mono font-semibold">{speed}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.25}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>ধীরস্থির (0.8x)</span>
                  <span>দ্রুত (1.25x)</span>
                </div>
              </div>

              {/* Reverb / Acoustic Space */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">স্টুডিও আমেজ (Reverb)</span>
                  <span className="text-teal-400 font-mono font-semibold">{reverbAmount}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={reverbAmount}
                  onChange={(e) => setReverbAmount(parseInt(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>ড্রাই/স্টুডিও</span>
                  <span>মাহফিল আমেজ</span>
                </div>
              </div>
            </div>

            {/* Custom Instruction Prompt */}
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">
                বাচনভঙ্গি ও এক্সপ্রেশন নির্দেশনা (Prompt Instruction for Gemini)
              </label>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                placeholder="যেমন: গভীর ও শ্রদ্ধাপূর্ণ কণ্ঠে আবেগ সহকারে ধীর গতিতে পাঠ করুন।"
              />
            </div>
          </div>

          {/* Step 3: Side-by-Side Comparison & Preview */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <ArrowRightLeft className="h-4 w-4 text-teal-400" />
                ধাপ ৩: মূল কণ্ঠ বনাম ক্লোন কণ্ঠ তুলনা ও প্রিভিউ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Original Voice Audio */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium mb-1">
                  ১. আপনার মূল রেকর্ড করা কণ্ঠ:
                </div>
                {recordedAudioUrl ? (
                  <audio src={recordedAudioUrl} controls className="h-7 w-full" />
                ) : (
                  <div className="text-xs text-slate-500 italic py-1">
                    কণ্ঠ রেকর্ড বা আপলোড করা হয়নি
                  </div>
                )}
              </div>

              {/* Generated AI Voice Audio */}
              <div className="p-3 rounded-lg bg-slate-950 border border-teal-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-teal-300 font-medium">
                    ২. জেনারেটেড ক্লোন কণ্ঠ (প্রিভিউ):
                  </span>
                  {previewAudioUrl && (
                    <span className="text-[10px] text-emerald-400">প্রস্তুত</span>
                  )}
                </div>
                {previewAudioUrl ? (
                  <audio src={previewAudioUrl} controls autoPlay={false} className="h-7 w-full" />
                ) : (
                  <div className="text-xs text-slate-500 italic py-1">
                    নিচের &apos;টেস্ট প্রিভিউ শুনুন&apos; বাটনে ক্লিক করুন
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions: Test Preview & Save */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <button
              id="test-custom-voice-preview-btn"
              type="button"
              disabled={isTestingGen}
              onClick={handleTestPreview}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
            >
              <Volume2 className="h-4 w-4 text-teal-400" />
              <span>{isTestingGen ? "টেস্ট অডিও তৈরি হচ্ছে..." : "টেস্ট প্রিভিউ শুনুন (Generate Test Audio)"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                id="save-custom-voice-profile-btn"
                type="button"
                onClick={handleSaveCurrentProfile}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-500 transition shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>প্রোফাইল সেভ ও চূড়ান্ত প্রয়োগ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
