"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Volume2,
  VolumeX,
  Sparkles,
  Share2,
  Check,
} from "lucide-react";
import { formatTime } from "../utils/audioHelper";
import AudioVisualizer from "./AudioVisualizer";

interface AudioPlayerProps {
  blobUrl: string | null;
  wavBlob: Blob | null;
  voiceName: string;
  title: string;
  onPlaybackTimeUpdate?: (currentTime: number, duration: number) => void;
}

export default function AudioPlayer({
  blobUrl,
  wavBlob,
  voiceName,
  title,
  onPlaybackTimeUpdate,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (audioRef.current && blobUrl) {
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [blobUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current || !blobUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Playback error:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(curr);
    if (!isNaN(dur) && dur > 0) {
      setDuration(dur);
    }
    if (onPlaybackTimeUpdate) {
      onPlaybackTimeUpdate(curr, dur);
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (!isNaN(dur)) {
      setDuration(dur);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const targetTime = parseFloat(e.target.value);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const skipSeconds = (sec: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + sec));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `bangla_voice_${voiceName.toLowerCase()}_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyAudioLink = () => {
    if (!blobUrl) return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!blobUrl) {
    return (
      <div
        id="audio-player-empty"
        className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-emerald-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-slate-200">
          অডিও এখনো তৈরি হয়নি
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          উপরের &quot;বাংলা অডিও তৈরি করুন&quot; বাটনে ক্লিক করে ভয়েস উৎপন্ন করুন।
        </p>
      </div>
    );
  }

  return (
    <div
      id="main-audio-player"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-5 shadow-xl shadow-emerald-950/20 backdrop-blur-md"
    >
      <audio
        ref={audioRef}
        src={blobUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini 3.1 Flash TTS
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ভয়েস: {voiceName}
            </span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-100 line-clamp-1">
            {title || "বাংলা অডিও বিবরণ"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="download-audio-btn"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-500/30 transition hover:bg-emerald-600 hover:text-white"
            title="Download .WAV audio"
          >
            <Download className="h-3.5 w-3.5" />
            <span>ডাউনলোড (WAV)</span>
          </button>

          <button
            id="share-audio-btn"
            onClick={handleCopyAudioLink}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 transition hover:bg-slate-700"
            title="Share"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>শেয়ার</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visualizer & Progress */}
      <div className="my-4 space-y-3">
        <AudioVisualizer isPlaying={isPlaying} barCount={36} />

        {/* Custom Progress Bar */}
        <div className="space-y-1">
          <div className="relative group">
            <input
              id="audio-progress-slider"
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 rounded-lg appearance-none bg-slate-800 cursor-pointer accent-emerald-400 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #10b981 ${progressPercent}%, #334155 ${progressPercent}%)`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {/* Playback speed options */}
        <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 border border-slate-700/60">
          {[0.8, 1.0, 1.2, 1.5].map((speed) => (
            <button
              key={speed}
              id={`speed-btn-${speed}`}
              onClick={() => setPlaybackRate(speed)}
              className={`px-2 py-0.5 text-xs rounded font-medium transition ${
                playbackRate === speed
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Center Main Play / Seek Controls */}
        <div className="flex items-center gap-3">
          <button
            id="rewind-5s-btn"
            onClick={() => skipSeconds(-5)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Rewind 5s"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            id="toggle-play-btn"
            onClick={togglePlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/30 hover:scale-105 active:scale-95 transition"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            id="forward-5s-btn"
            onClick={() => skipSeconds(5)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Forward 5s"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <button
            id="mute-toggle-btn"
            onClick={() => setIsMuted(!isMuted)}
            className="text-slate-400 hover:text-slate-200 transition"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4 text-red-400" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>
      </div>
    </div>
  );
}
