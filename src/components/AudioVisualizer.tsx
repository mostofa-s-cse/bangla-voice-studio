"use client";

import { motion } from "motion/react";

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
}

export default function AudioVisualizer({ isPlaying, barCount = 28 }: AudioVisualizerProps) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div
      id="audio-visualizer-container"
      className="flex items-center justify-center gap-[3px] h-12 px-4 py-2 bg-slate-900/60 rounded-xl border border-emerald-900/40"
    >
      {bars.map((i) => {
        // Vary heights for wave-like visual effect
        const randomHeight = isPlaying
          ? [15, 60, 30, 90, 45, 100, 20][i % 7]
          : 12;
        const duration = 0.4 + (i % 5) * 0.15;

        return (
          <motion.div
            key={i}
            id={`visualizer-bar-${i}`}
            className="w-1 rounded-full bg-gradient-to-t from-emerald-600 via-teal-400 to-emerald-300"
            animate={{
              height: isPlaying ? [`${Math.max(15, randomHeight * 0.4)}%`, `${randomHeight}%`, `${Math.max(20, randomHeight * 0.7)}%`] : "12%",
              opacity: isPlaying ? [0.6, 1, 0.7] : 0.35,
            }}
            transition={{
              repeat: Infinity,
              repeatType: "reverse",
              duration: isPlaying ? duration : 1,
              ease: "easeInOut",
              delay: (i * 0.04) % 0.4,
            }}
            style={{ minHeight: "4px" }}
          />
        );
      })}
    </div>
  );
}
