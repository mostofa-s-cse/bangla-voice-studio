"use client";

import { useState } from "react";
import { Copy, Check, BookOpen, Sparkles, FileText, ChevronRight } from "lucide-react";
import { STORY_PRESETS } from "../data/presets";
import { StoryPreset } from "../types";

interface NarrationReaderProps {
  text: string;
  onChangeText: (newText: string) => void;
  onSelectPreset: (preset: StoryPreset) => void;
  disabled?: boolean;
}

export default function NarrationReader({
  text,
  onChangeText,
  onSelectPreset,
  disabled,
}: NarrationReaderProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  // Average speaking rate in Bengali ~ 120-140 words per minute
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 130) * 60));
  const estMins = Math.floor(estimatedSeconds / 60);
  const estSecs = estimatedSeconds % 60;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paragraphs = text
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div id="narration-editor-container" className="space-y-4">
      {/* Preset Badges Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            ঐতিহাসিক ঘটনা ও টেক্সট নির্বাচন
          </label>
          <span className="text-[11px] text-slate-500 font-mono">
            {charCount} অক্ষর • {wordCount} শব্দ • আনুমানিক {estMins > 0 ? `${estMins} মি ` : ""}{estSecs} সেকেন্ড
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {STORY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              id={`preset-btn-${preset.id}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(preset)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-950/30 hover:text-emerald-300 transition"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium">{preset.title.split(":")[0]}</span>
              <ChevronRight className="h-3 w-3 text-slate-500" />
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Viewer Box */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner backdrop-blur-sm focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40 transition">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
              <Sparkles className="h-3 w-3" />
              বাংলা টেক্সট
            </span>
            <button
              id="toggle-edit-mode-btn"
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-slate-400 hover:text-slate-200 underline decoration-slate-600 underline-offset-2"
            >
              {isEditing ? "পড়ার মোড দেখুন" : "টেক্সট এডিট করুন"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-text-btn"
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition bg-slate-800/60 px-2.5 py-1 rounded"
              title="Copy text"
            >
              {copied ? (
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
        </div>

        {isEditing ? (
          <textarea
            id="narration-text-input"
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            disabled={disabled}
            rows={10}
            className="w-full bg-transparent text-sm md:text-base leading-relaxed text-slate-100 placeholder-slate-500 focus:outline-none resize-y font-normal"
            placeholder="এখানে যেকোনো বাংলা টেক্সট বা ঘটনা লিখুন..."
          />
        ) : (
          <div
            id="narration-text-display"
            className="space-y-3 max-h-[360px] overflow-y-auto pr-2 text-sm md:text-base leading-relaxed text-slate-200 select-text"
          >
            {paragraphs.map((p, idx) => {
              const isQuote = p.startsWith("“") || p.startsWith('"');
              const isKeyMoment = p.includes("আল্লাহ তাদের বংশধরদের") || p.includes("হেদায়েতের আশা");
              return (
                <p
                  key={idx}
                  className={`p-2.5 rounded-lg transition ${
                    isKeyMoment
                      ? "bg-emerald-950/40 border-l-4 border-emerald-400 text-emerald-100 font-medium shadow-sm"
                      : isQuote
                      ? "bg-teal-950/30 border-l-2 border-teal-400/60 italic text-teal-100"
                      : "text-slate-300"
                  }`}
                >
                  {p}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
