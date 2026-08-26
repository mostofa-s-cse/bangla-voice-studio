"use client";

import { Mic, User, Sparkles, Sliders } from "lucide-react";
import { VOICE_OPTIONS } from "../data/presets";
import { CustomVoiceProfile, ToneStyle } from "../types";

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  selectedTone: ToneStyle;
  onSelectTone: (tone: ToneStyle) => void;
  activeCustomProfile: CustomVoiceProfile | null;
  onClearCustomProfile: () => void;
  disabled?: boolean;
}

export default function VoiceSelector({
  selectedVoice,
  onSelectVoice,
  selectedTone,
  onSelectTone,
  activeCustomProfile,
  onClearCustomProfile,
  disabled,
}: VoiceSelectorProps) {
  const tones: { id: ToneStyle; titleBn: string; descBn: string; icon: string }[] = [
    {
      id: "reverent",
      titleBn: "শ্রদ্ধাশীল ও গম্ভীর",
      descBn: "গম্ভীর ও ভাবগম্ভীর বিষয়ের জন্য উপযুক্ত হৃদয়স্পর্শী সুর",
      icon: "✨",
    },
    {
      id: "storyteller",
      titleBn: "গল্প বলার ভঙ্গি",
      descBn: "উষ্ণ, আবেগপূর্ণ ও প্রাণবন্ত উপস্থাপন",
      icon: "📖",
    },
    {
      id: "formal",
      titleBn: "স্পষ্ট ও শুদ্ধ বাচন",
      descBn: "প্রমিত ও সাবলীল স্পষ্ট উচ্চারণ",
      icon: "🎙️",
    },
  ];

  return (
    <div id="voice-tone-selector-container" className="space-y-4">
      {/* Voice Selection */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5 text-emerald-400" />
            বেস ভয়েস নির্বাচন (Gemini TTS Voice)
          </label>
          {activeCustomProfile ? (
            <span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
              <Sliders className="h-3 w-3" /> কাস্টম প্রোফাইল সক্রিয়
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">5টি কণ্ঠ উপলব্ধ</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {VOICE_OPTIONS.map((voice) => {
            const isSelected = selectedVoice === voice.id && !activeCustomProfile;
            return (
              <button
                key={voice.id}
                id={`voice-option-${voice.id}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectVoice(voice.id);
                  if (activeCustomProfile) onClearCustomProfile();
                }}
                className={`relative flex items-start gap-3 p-3 text-left rounded-xl border transition-all ${
                  isSelected
                    ? "bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${voice.avatarColor} text-white shadow-sm`}
                >
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">
                      {voice.bnName}
                    </span>
                    {isSelected && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                    {voice.styleBn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tone Style Selection */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-teal-400" />
          উপস্থাপনের ভাব ও ধরণ (Narration Mood)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tones.map((t) => {
            const isSelected = selectedTone === t.id && !activeCustomProfile;
            return (
              <button
                key={t.id}
                id={`tone-option-${t.id}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectTone(t.id);
                  if (activeCustomProfile) onClearCustomProfile();
                }}
                className={`flex flex-col p-2.5 rounded-lg border text-left transition ${
                  isSelected
                    ? "bg-teal-950/50 border-teal-500 text-teal-200 shadow-sm"
                    : "bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <span>{t.icon}</span>
                  {t.titleBn}
                </span>
                <span className="mt-1 text-[11px] text-slate-400 leading-snug">
                  {t.descBn}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
