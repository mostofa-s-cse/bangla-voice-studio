"use client";

import { useState, useRef, useEffect } from "react";
import {
  Video,
  Upload,
  Play,
  Pause,
  Type,
  Palette,
  Download,
  Volume2,
  VolumeX,
  Check,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { GeneratedAudioItem, SubtitleCue, VideoSubtitleStyle } from "../types";
import { BANGLA_FONT_OPTIONS, generateAutoSubtitles, exportToSrt } from "../utils/videoSubtitles";

interface VideoVoiceStudioProps {
  currentAudio: GeneratedAudioItem | null;
  narrationText: string;
}

export default function VideoVoiceStudio({ currentAudio, narrationText }: VideoVoiceStudioProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [videoMuted, setVideoMuted] = useState<boolean>(true); // mute original video audio to prioritize generated voice

  // Subtitles & Cues
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Subtitle Style Settings
  const [subtitleStyle, setSubtitleStyle] = useState<VideoSubtitleStyle>({
    fontFamily: "'Hind Siliguri', sans-serif",
    fontSize: 28,
    color: "#ffffff",
    backgroundColor: "#000000",
    strokeColor: "#000000",
    strokeWidth: 2,
    position: "bottom",
    animation: "fade",
    bgOpacity: 0.65,
  });

  // Preset Video Background Samples for immediate testing
  const sampleVideos = [
    {
      name: "প্রাকৃতিক দৃশ্য ও নদী (Nature Scenic)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    },
    {
      name: "শান্ত আকাশ ও পাহাড় (Serene Sky)",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    },
  ];

  // Video and Audio element refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measure audio duration whenever currentAudio changes.
  // Resetting to the deterministic "no audio" state is a one-time sync, not a render loop risk.
  useEffect(() => {
    if (!currentAudio?.blobUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAudioDuration(0);
      return;
    }
    const tempAudio = new Audio(currentAudio.blobUrl);
    tempAudio.onloadedmetadata = () => {
      const dur = tempAudio.duration || 10;
      setAudioDuration(dur);
      // Auto generate synchronized subtitles
      const newCues = generateAutoSubtitles(currentAudio.text || narrationText, dur);
      setCues(newCues);
    };
  }, [currentAudio, narrationText]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Sync playback between Video and Generated Voice Audio
  const handleTogglePlay = () => {
    const video = videoRef.current;
    const audio = audioRef.current;

    if (!video) return;

    if (isPlaying) {
      video.pause();
      if (audio) audio.pause();
      setIsPlaying(false);
    } else {
      // Ensure sync on play start
      if (audio && currentAudio) {
        audio.currentTime = video.currentTime;
        audio.play().catch(console.error);
      }
      video.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const time = video.currentTime;
    setCurrentTime(time);

    // Sync Audio drift check
    if (audio && currentAudio && Math.abs(audio.currentTime - time) > 0.3) {
      audio.currentTime = time;
    }

    // Find active subtitle cue
    const currentCue = cues.find((c) => time >= c.startTime && time <= c.endTime);
    setActiveCueText(currentCue ? currentCue.text : "");
  };

  const handleVideoLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(video.duration);
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoLoadError(null);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSelectSampleVideo = (url: string) => {
    setVideoLoadError(null);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioRef.current && currentAudio) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleDownloadSrt = () => {
    if (cues.length === 0) return;
    const srtContent = exportToSrt(cues);
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentAudio?.title || "bangla_voice_subtitles"}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Re-generate / re-sync subtitles
  const handleRegenerateSubtitles = () => {
    setIsSyncing(true);
    const dur = audioDuration > 0 ? audioDuration : videoDuration > 0 ? videoDuration : 15;
    const newCues = generateAutoSubtitles(currentAudio?.text || narrationText, dur);
    setCues(newCues);
    setTimeout(() => setIsSyncing(false), 300);
  };

  // Update specific cue timing or text
  const handleUpdateCueText = (id: string, newText: string) => {
    setCues((prev) => prev.map((c) => (c.id === id ? { ...c, text: newText } : c)));
  };

  // Position CSS mapping
  const getPositionClass = () => {
    switch (subtitleStyle.position) {
      case "top":
        return "top-6 items-start";
      case "middle":
        return "top-1/2 -translate-y-1/2 items-center";
      case "bottom":
      default:
        return "bottom-6 items-end";
    }
  };

  return (
    <div
      id="video-voice-studio-container"
      className="rounded-2xl border border-teal-500/40 bg-slate-900/60 p-5 sm:p-7 backdrop-blur-md shadow-xl space-y-6"
    >
      {/* Hidden Audio element for synchronized voice playback */}
      {currentAudio?.blobUrl && (
        <audio
          ref={audioRef}
          src={currentAudio.blobUrl}
          onEnded={() => {
            if (videoRef.current) videoRef.current.pause();
            setIsPlaying(false);
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Video className="h-4 w-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              ভিডিওর সাথে ভয়েস ও স্ক্রিন টেক্সট / সাবটাইটেল সিঙ্ক স্টুডিও
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            ভিডিও আপলোড করুন, জেনারেট করা ভয়েস যুক্ত করুন এবং স্ক্রিনে পছন্দের বাংলা ফন্টে সিঙ্ক্রোনাইজড টেক্সট প্রদর্শন করুন।
          </p>
        </div>

        {/* Audio Verification Status Badge */}
        <div className="flex items-center gap-2">
          {currentAudio ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>ভয়েস প্রস্তুত ও সিঙ্কযোগ্য ({currentAudio.voice})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>প্রথমে উপরে ভয়েস তৈরি ও চেক করে নিন</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Grid: Video Player (Left/Top) and Font/Style Editor (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Video Stage with Subtitle Overlay */}
        <div className="lg:col-span-7 space-y-4">
          {/* Video Player Canvas */}
          <div
            ref={containerRef}
            id="video-player-stage"
            className="relative w-full aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group"
          >
            {videoUrl && !videoLoadError ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted={videoMuted}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onError={() => {
                  setVideoLoadError("ভিডিওটি লোড করা সম্ভব হয়নি। অনুগ্রহ করে আপনার ডিভাইস থেকে MP4 ফাইল আপলোড করুন।");
                  setVideoUrl(null);
                }}
                onEnded={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlaying(false);
                }}
                className="w-full h-full object-contain"
                playsInline
              />
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3 bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-900 overflow-hidden">
                {/* Subtle animated particles/circles for atmospheric motion background */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full bg-teal-500/20 blur-3xl animate-pulse" />
                  <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full bg-emerald-500/20 blur-3xl animate-pulse delay-1000" />
                </div>

                <div className="relative z-10 flex flex-col items-center space-y-3 max-w-md">
                  <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/30 text-teal-300 shadow-inner">
                    <Video className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      {videoLoadError ? "ভিডিও সংযোগ ত্রুটি" : "মোশন ব্যাকগ্রাউন্ড ও ভিডিও ক্যানভাস"}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {videoLoadError ||
                        "আপনার ভিডিও ফাইল আপলোড করুন অথবা সরাসরি এই ডায়নামিক ব্যাকগ্রাউন্ডে টেক্সট ও ভয়েস প্রিভিউ দেখুন।"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setVideoLoadError(null);
                        fileInputRef.current?.click();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition shadow-md cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>ভিডিও ফাইল আপলোড করুন (MP4)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Subtitle Overlay on Screen */}
            {activeCueText && (
              <div
                id="active-subtitle-overlay"
                className={`absolute inset-x-4 pointer-events-none flex justify-center ${getPositionClass()} z-20 transition-all duration-150`}
              >
                <div
                  className="max-w-[90%] text-center px-4 py-1.5 rounded-lg shadow-lg"
                  style={{
                    fontFamily: subtitleStyle.fontFamily,
                    fontSize: `${subtitleStyle.fontSize}px`,
                    color: subtitleStyle.color,
                    backgroundColor: `rgba(${parseInt(
                      subtitleStyle.backgroundColor.slice(1, 3),
                      16
                    )}, ${parseInt(subtitleStyle.backgroundColor.slice(3, 5), 16)}, ${parseInt(
                      subtitleStyle.backgroundColor.slice(5, 7),
                      16
                    )}, ${subtitleStyle.bgOpacity})`,
                    textShadow:
                      subtitleStyle.strokeWidth > 0
                        ? `0 0 ${subtitleStyle.strokeWidth * 2}px ${subtitleStyle.strokeColor}`
                        : "none",
                    lineHeight: 1.4,
                  }}
                >
                  {activeCueText}
                </div>
              </div>
            )}

            {/* Video Overlay Controls */}
            {videoUrl && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between pointer-events-none">
                {/* Top Status */}
                <div className="flex items-center justify-between text-xs text-slate-200 pointer-events-auto">
                  <span className="font-medium bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                    {currentAudio ? `ভয়েস অডিও সিঙ্কড: ${currentAudio.voice}` : "মূল ভিডিও অডিও"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVideoMuted(!videoMuted)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition flex items-center gap-1"
                    title={videoMuted ? "ভিডিও মিউট করা (AI ভয়েস চলবে)" : "ভিডিও আনমিউট"}
                  >
                    {videoMuted ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px]">মূল সাউন্ড মিউট (AI ভয়েস অন)</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[10px]">ভিডিও সাউন্ড অন</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bottom Timeline & Controls */}
                <div className="space-y-2 pointer-events-auto">
                  {/* Seek bar */}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(videoDuration, audioDuration, 1)}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-700/80 rounded"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-200">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="p-2 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition shadow"
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4 fill-current" />
                        ) : (
                          <Play className="h-4 w-4 fill-current ml-0.5" />
                        )}
                      </button>

                      <span className="font-mono text-[11px]">
                        {new Date(currentTime * 1000).toISOString().substring(14, 19)} /{" "}
                        {new Date(
                          Math.max(videoDuration, audioDuration) * 1000
                        )
                          .toISOString()
                          .substring(14, 19)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-teal-300 font-mono bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                        {cues.length} টি সাবটাইটেল কিউ
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video Import Options */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/30 border border-teal-500/40 text-teal-200 text-xs font-semibold hover:bg-teal-600/50 transition cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>নিজের ভিডিও আপলোড (MP4/WebM)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileUpload}
                className="hidden"
              />

              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span className="text-slate-600">বা স্যাম্পল:</span>
                {sampleVideos.map((sv, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSampleVideo(sv.url)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
                  >
                    {sv.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtitle SRT download */}
            {cues.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadSrt}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                title="Download SRT subtitle file for Premiere Pro / CapCut"
              >
                <Download className="h-3.5 w-3.5 text-teal-400" />
                <span>SRT ফাইল ডাউনলোড</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Bangla Font Selection & Subtitle Styling Customizer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-4">
            {/* Step 1: Select Bengali Font */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5" />
                  বাংলা ফন্ট নির্বাচন (Select Bangla Font)
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Google Fonts</span>
              </label>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {BANGLA_FONT_OPTIONS.map((f) => {
                  const isSelected = subtitleStyle.fontFamily === f.fontFamily;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSubtitleStyle({ ...subtitleStyle, fontFamily: f.fontFamily })}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition ${
                        isSelected
                          ? "bg-teal-950/60 border-teal-400 text-white ring-1 ring-teal-400 shadow-sm"
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{f.name}</span>
                          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                            {f.category}
                          </span>
                        </div>
                        <div
                          className="text-sm text-teal-300 mt-1 truncate"
                          style={{ fontFamily: f.fontFamily }}
                        >
                          {f.sample}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-teal-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Styling Controls (Size, Colors, Position, Background) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-emerald-400" />
                টেক্সট সাইজ ও ভিজ্যুয়াল স্টাইল (Visual Appearance)
              </label>

              {/* Font Size & Position Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Font Size */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">ফন্ট সাইজ</span>
                    <span className="text-teal-400 font-mono">{subtitleStyle.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={48}
                    step={2}
                    value={subtitleStyle.fontSize}
                    onChange={(e) =>
                      setSubtitleStyle({ ...subtitleStyle, fontSize: parseInt(e.target.value) })
                    }
                    className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                </div>

                {/* Text Position */}
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 block">স্ক্রিনে অবস্থান</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(["bottom", "middle", "top"] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setSubtitleStyle({ ...subtitleStyle, position: pos })}
                        className={`py-1 text-[11px] font-medium rounded border transition ${
                          subtitleStyle.position === pos
                            ? "bg-teal-600 text-white border-teal-400 font-semibold"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {pos === "bottom" ? "নিচে" : pos === "middle" ? "মাঝে" : "উপরে"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Text Color & Background Opacity Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Text Color Presets */}
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 block">টেক্সট কালার</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { code: "#ffffff", name: "সাদা" },
                      { code: "#facc15", name: "হলুদ" },
                      { code: "#38bdf8", name: "আকাশি" },
                      { code: "#4ade80", name: "সবুজ" },
                    ].map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setSubtitleStyle({ ...subtitleStyle, color: c.code })}
                        style={{ backgroundColor: c.code }}
                        className={`h-6 w-6 rounded-full border-2 transition ${
                          subtitleStyle.color === c.code ? "border-teal-400 scale-110" : "border-slate-800"
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Background Shadow / Opacity */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">ব্যাকগ্রাউন্ড শেড</span>
                    <span className="text-teal-400 font-mono">
                      {Math.round(subtitleStyle.bgOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.1}
                    value={subtitleStyle.bgOpacity}
                    onChange={(e) =>
                      setSubtitleStyle({
                        ...subtitleStyle,
                        bgOpacity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Interactive Subtitle Timings & Editing List */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-teal-400" />
                  সিঙ্ক্রোনাইজড টেক্সট কিউ তালিকা ({cues.length})
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateSubtitles}
                  disabled={isSyncing}
                  className="text-[11px] text-teal-400 hover:text-white underline"
                >
                  {isSyncing ? "সিঙ্ক হচ্ছে..." : "পুনরায় সিঙ্ক করুন"}
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {cues.length > 0 ? (
                  cues.map((cue, idx) => {
                    const isActive = currentTime >= cue.startTime && currentTime <= cue.endTime;
                    return (
                      <div
                        key={cue.id}
                        onClick={() => {
                          if (videoRef.current) videoRef.current.currentTime = cue.startTime;
                          if (audioRef.current && currentAudio)
                            audioRef.current.currentTime = cue.startTime;
                        }}
                        className={`p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isActive
                            ? "bg-teal-950/80 border-teal-400 text-teal-100 shadow-sm"
                            : "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 mb-1">
                          <span className="text-teal-400 font-semibold">#{idx + 1}</span>
                          <span>
                            {cue.startTime.toFixed(1)}s - {cue.endTime.toFixed(1)}s
                          </span>
                        </div>
                        <input
                          type="text"
                          value={cue.text}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleUpdateCueText(cue.id, e.target.value)}
                          className="w-full bg-transparent text-slate-200 focus:outline-none focus:bg-slate-900/80 px-1 py-0.5 rounded"
                          style={{ fontFamily: subtitleStyle.fontFamily }}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-500 text-center py-4 italic">
                    ভয়েস তৈরি করার পর অটোমেটিক সাবটাইটেল সিঙ্ক হবে
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
