"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Volume2,
  AlertCircle,
  Loader2,
  History,
  Trash2,
  Sliders,
} from "lucide-react";
import { DEFAULT_NARRATION_TEXT, DEFAULT_NARRATION_TITLE, VOICE_OPTIONS } from "@/data/presets";
import { CustomVoiceProfile, GeneratedAudioItem, StoryPreset, ToneStyle } from "@/types";
import { base64PcmToWavBlob } from "@/utils/audioHelper";
import { applyDspEffectsToBlob } from "@/utils/audioEffects";
import VoiceSelector from "@/components/VoiceSelector";
import NarrationReader from "@/components/NarrationReader";
import AudioPlayer from "@/components/AudioPlayer";
import CustomVoiceStudio from "@/components/CustomVoiceStudio";
import VideoVoiceStudio from "@/components/VideoVoiceStudio";

const STORAGE_KEY_PROFILES = "bangla_custom_voice_profiles_v1";

const DEFAULT_CUSTOM_PROFILES: CustomVoiceProfile[] = [
  {
    id: "preset-profile-1",
    name: "গভীর ও ভাবগম্ভীর কণ্ঠ",
    baseVoice: "Fenrir",
    gender: "male",
    pitchSemitones: -2,
    speed: 1.0,
    bassBoost: 5,
    reverbAmount: 25,
    warmth: 65,
    customInstruction: "গভীর, দরাজ ও স্পষ্ট কণ্ঠে আবেগপূর্ণ পাঠ।",
    createdAt: 0,
  },
  {
    id: "preset-profile-2",
    name: "কোমল ও প্রশান্তিদায়ক নারী কণ্ঠ",
    baseVoice: "Kore",
    gender: "female",
    pitchSemitones: 0,
    speed: 0.95,
    bassBoost: 2,
    reverbAmount: 30,
    warmth: 70,
    customInstruction: "কোমল, প্রশান্তিদায়ক ও হৃদয়স্পর্শী সুরে ধীরে ধীরে পাঠ করুন।",
    createdAt: 0,
  },
];

export default function Home() {
  const [text, setText] = useState<string>(DEFAULT_NARRATION_TEXT);
  const [currentTitle, setCurrentTitle] = useState<string>(DEFAULT_NARRATION_TITLE);
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [selectedTone, setSelectedTone] = useState<ToneStyle>("reverent");

  // Custom Voice Profiles — same default on server & client render; real
  // localStorage value (if any) is applied post-mount to avoid a hydration mismatch.
  const [customProfiles, setCustomProfiles] = useState<CustomVoiceProfile[]>(
    DEFAULT_CUSTOM_PROFILES
  );
  const skipNextPersist = useRef(true);

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentAudio, setCurrentAudio] = useState<GeneratedAudioItem | null>(null);
  const [history, setHistory] = useState<GeneratedAudioItem[]>([]);

  // Load saved custom profiles from localStorage once mounted (client-only).
  // One-time sync from an external system on mount — intentional, not a render-loop risk.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILES);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCustomProfiles(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Save custom profiles to localStorage (skip the initial mount so the
  // default profiles above don't clobber a real saved value before it loads)
  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(customProfiles));
    } catch (e) {
      console.error(e);
    }
  }, [customProfiles]);

  const activeCustomProfile = customProfiles.find((p) => p.id === activeProfileId) || null;

  const handleSaveProfile = (profile: CustomVoiceProfile) => {
    setCustomProfiles((prev) => {
      const filtered = prev.filter((p) => p.id !== profile.id);
      return [profile, ...filtered];
    });
    setActiveProfileId(profile.id);
  };

  const handleDeleteProfile = (profileId: string) => {
    setCustomProfiles((prev) => prev.filter((p) => p.id !== profileId));
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
    }
  };

  const handleSelectProfile = (profile: CustomVoiceProfile | null) => {
    if (profile) {
      setActiveProfileId(profile.id);
      setSelectedVoice(profile.baseVoice);
      setSelectedTone("custom");
    } else {
      setActiveProfileId(null);
      setSelectedTone("reverent");
    }
  };

  // Generate Bangla Voice with Gemini TTS + Custom Audio Processing
  const handleGenerateAudio = async () => {
    if (!text.trim()) {
      setErrorMessage("অনুগ্রহ করে একটি টেক্সট লিখুন বা নির্বাচন করুন।");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep("Gemini TTS থেকে মূল অডিও তৈরি হচ্ছে...");

    try {
      const voiceToUse = activeCustomProfile ? activeCustomProfile.baseVoice : selectedVoice;
      const customInst = activeCustomProfile ? activeCustomProfile.customInstruction : "";

      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: voiceToUse,
          tone: activeCustomProfile ? "custom" : selectedTone,
          customInstruction: customInst,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.audioBase64) {
        throw new Error(
          data.error || "অডিও রূপান্তর করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
        );
      }

      setGenerationStep("অডিও টিউনিং ও স্টুডিও ইফেক্ট প্রয়োগ হচ্ছে...");

      // 1. Convert base64 PCM to raw WAV Blob
      const rawWavBlob = base64PcmToWavBlob(data.audioBase64, data.sampleRate || 24000);

      // 2. Apply Custom DSP Effects if custom profile is active
      let finalWavBlob = rawWavBlob;
      if (activeCustomProfile) {
        finalWavBlob = await applyDspEffectsToBlob(rawWavBlob, {
          pitchSemitones: activeCustomProfile.pitchSemitones,
          speed: activeCustomProfile.speed,
          bassBoostDb: activeCustomProfile.bassBoost,
          reverbPercent: activeCustomProfile.reverbAmount,
          warmthPercent: activeCustomProfile.warmth,
        });
      }

      const blobUrl = URL.createObjectURL(finalWavBlob);

      const newItem: GeneratedAudioItem = {
        id: `audio-${Date.now()}`,
        timestamp: Date.now(),
        text: text.trim(),
        voice: voiceToUse,
        tone: activeCustomProfile ? "custom" : selectedTone,
        blobUrl,
        duration: 0,
        wavBlob: finalWavBlob,
        title: currentTitle || "বাংলা অডিও বিবরণ",
        customProfileName: activeCustomProfile?.name,
      };

      setCurrentAudio(newItem);
      setHistory((prev) => [newItem, ...prev.slice(0, 7)]);
    } catch (err) {
      console.error("TTS error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "অডিও ফাইল তৈরিতে ব্যর্থ হয়েছে। সার্ভার স্ট্যাটাস চেক করুন।"
      );
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleSelectPreset = (preset: StoryPreset) => {
    setText(preset.text);
    setCurrentTitle(preset.title);
  };

  const handleSelectHistoryItem = (item: GeneratedAudioItem) => {
    setCurrentAudio(item);
    setText(item.text);
    setSelectedVoice(item.voice);
    setSelectedTone(item.tone);
    setCurrentTitle(item.title);
  };

  const handleClearHistory = () => {
    history.forEach((h) => URL.revokeObjectURL(h.blobUrl));
    setHistory([]);
  };

  const currentVoiceObj = VOICE_OPTIONS.find(
    (v) => v.id === (activeCustomProfile ? activeCustomProfile.baseVoice : selectedVoice)
  );

  return (
    <div
      id="app-root-container"
      className="min-h-screen bg-[#090e17] text-slate-100 selection:bg-emerald-500 selection:text-white"
    >
      {/* Subtle Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-96 right-10 w-[400px] h-[300px] bg-teal-500/8 blur-[100px] rounded-full" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[250px] bg-indigo-500/8 blur-[120px] rounded-full" />
      </div>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
        {/* Header Branding */}
        <header id="main-header" className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-xs font-medium shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Gemini 3.1 Flash TTS + কাস্টম ভয়েস স্টুডিও</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
            বাংলা ভয়েস ও কাস্টম অডিও জেনারেটর
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed font-normal">
            গল্প, প্রবন্ধ, খবর বা যেকোনো বাংলা টেক্সট থেকে তৈরি করুন প্রাঞ্জল অডিও অথবা আপনার নিজস্ব কাস্টম ভয়েস প্রোফাইল।
          </p>
        </header>

        {/* Error Alert if any */}
        {errorMessage && (
          <div
            id="error-banner"
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

        {/* Custom Voice Studio Bar & Creator Modal */}
        <section id="custom-voice-studio-section" aria-label="Custom Voice Studio">
          <CustomVoiceStudio
            customProfiles={customProfiles}
            activeProfileId={activeProfileId}
            onSaveProfile={handleSaveProfile}
            onDeleteProfile={handleDeleteProfile}
            onSelectProfile={handleSelectProfile}
            disabled={isGenerating}
          />
        </section>

        {/* Active Audio Player Section */}
        <section id="audio-player-section" aria-label="Audio Playback">
          <AudioPlayer
            blobUrl={currentAudio?.blobUrl || null}
            wavBlob={currentAudio?.wavBlob || null}
            voiceName={
              currentAudio?.customProfileName
                ? `কাস্টম: ${currentAudio.customProfileName}`
                : currentAudio
                ? `${currentVoiceObj?.bnName || currentAudio.voice} (${currentAudio.tone})`
                : activeCustomProfile
                ? `কাস্টম: ${activeCustomProfile.name}`
                : selectedVoice
            }
            title={currentAudio?.title || currentTitle}
          />
        </section>

        {/* Narration Text & Presets */}
        <section id="narration-section" aria-label="Narration Text" className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm shadow-sm">
            <NarrationReader
              text={text}
              onChangeText={setText}
              onSelectPreset={handleSelectPreset}
              disabled={isGenerating}
            />
          </div>
        </section>

        {/* Voice Selection, Tone & Generate Action */}
        <section id="voice-generation-section" aria-label="Voice Selection and Generation" className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm shadow-sm space-y-6">
              {/* Active Profile Info Banner */}
              {activeCustomProfile && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-teal-950/40 border border-teal-500/40 text-teal-200 text-xs">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-teal-400" />
                    <div>
                      <span className="font-semibold">{activeCustomProfile.name}</span>
                      <p className="text-[11px] text-teal-300/80">
                        পিচ: {activeCustomProfile.pitchSemitones > 0 ? `+${activeCustomProfile.pitchSemitones}` : activeCustomProfile.pitchSemitones} st • খাদ: +{activeCustomProfile.bassBoost}dB • রিভার্ব: {activeCustomProfile.reverbAmount}%
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectProfile(null)}
                    className="text-[11px] text-teal-400 hover:text-white underline"
                  >
                    রিমুভ করুন
                  </button>
                </div>
              )}

              <VoiceSelector
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
                selectedTone={selectedTone}
                onSelectTone={setSelectedTone}
                activeCustomProfile={activeCustomProfile}
                onClearCustomProfile={() => setActiveProfileId(null)}
                disabled={isGenerating}
              />

              {/* Action Button */}
              <div className="pt-2">
                <button
                  id="generate-audio-submit-btn"
                  type="button"
                  disabled={isGenerating || !text.trim()}
                  onClick={handleGenerateAudio}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm transition-all shadow-lg ${
                    isGenerating
                      ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                      : activeCustomProfile
                      ? "bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-500 text-white shadow-teal-900/40 hover:from-teal-500 hover:to-emerald-400 hover:shadow-teal-900/60 active:scale-[0.99] cursor-pointer"
                      : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-400 hover:shadow-emerald-900/60 active:scale-[0.99] cursor-pointer"
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                      <span>{generationStep || "বাংলা অডিও তৈরি হচ্ছে..."}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-5 w-5" />
                      <span>
                        {activeCustomProfile
                          ? `কাস্টম ভয়েসে (${activeCustomProfile.name}) অডিও তৈরি করুন`
                          : "বাংলা অডিও তৈরি করুন"}
                      </span>
                    </>
                  )}
                </button>

                <p className="mt-2 text-center text-[11px] text-slate-500">
                  {activeCustomProfile
                    ? "কাস্টম বাচনভঙ্গি, পিচ ও স্টুডিও ইফেক্ট সহ জেনারেট হবে"
                    : "Gemini 3.1 Flash TTS মডেল দ্বারা দ্রুততম সময়ে প্রমিত বাংলা অডিও রূপান্তরিত হবে"}
                </p>
              </div>
            </div>

            {/* Recent History Snippets */}
            {history.length > 0 && (
              <div
                id="audio-history-section"
                className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-emerald-400" />
                    পূর্ববর্তী অডিও তালিকা ({history.length})
                  </span>
                  <button
                    id="clear-history-btn"
                    onClick={handleClearHistory}
                    className="text-[11px] text-slate-500 hover:text-red-400 transition flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    মুছে ফেলুন
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      id={`history-item-${item.id}`}
                      onClick={() => handleSelectHistoryItem(item)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs border transition ${
                        currentAudio?.id === item.id
                          ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                          : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.customProfileName
                            ? `কাস্টম: ${item.customProfileName}`
                            : `কণ্ঠ: ${item.voice}`} • {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <Volume2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
        </section>

        {/* Video Import, Voice Sync & On-Screen Bangla Font Subtitle Studio */}
        <section id="video-sync-studio-section" aria-label="Video Voice Sync and Subtitle Studio">
          <VideoVoiceStudio currentAudio={currentAudio} narrationText={text} />
        </section>

        {/* Footer Note */}
        <footer className="pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500 space-y-1">
          <p>
            যেকোনো বাংলা লেখাকে প্রাকৃতিক কণ্ঠে রূপান্তরের জন্য টেক্সট-টু-স্পিচ ও কাস্টম ভয়েস প্ল্যাটফর্ম।
          </p>
          <p className="text-[11px] text-slate-600 font-mono">
            Powered by Google Gemini 3.1 Flash TTS Preview
          </p>
        </footer>
      </main>
    </div>
  );
}
