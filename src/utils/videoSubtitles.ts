import { SubtitleCue } from "../types";

export interface BanglaFontOption {
  id: string;
  name: string;
  bnName: string;
  fontFamily: string;
  sample: string;
  category: string;
}

export const BANGLA_FONT_OPTIONS: BanglaFontOption[] = [
  {
    id: "hind-siliguri",
    name: "Hind Siliguri",
    bnName: "হিন্দ শিলিগুড়ি (আধুনিক ও স্পষ্ট)",
    fontFamily: "'Hind Siliguri', sans-serif",
    sample: "আল্লাহ পরম করুণাময় ও অসীম দয়ালু",
    category: "Sans-Serif",
  },
  {
    id: "anek-bangla",
    name: "Anek Bangla",
    bnName: "অনেক বাংলা (বোল্ড ও নজরকাড়া)",
    fontFamily: "'Anek Bangla', sans-serif",
    sample: "হাদিসের হৃদয়স্পর্শী ঘটনা",
    category: "Display",
  },
  {
    id: "noto-serif-bengali",
    name: "Noto Serif Bengali",
    bnName: "নোটো সেরিফ (শাস্ত্রীয় ও ইসলামিক ভাব)",
    fontFamily: "'Noto Serif Bengali', serif",
    sample: "রাসূলুল্লাহ (ﷺ) এর ক্ষমার অনুপম আদর্শ",
    category: "Serif",
  },
  {
    id: "tiro-bangla",
    name: "Tiro Bangla",
    bnName: "তিরো বাংলা (ঐতিহাসিক বইয়ের ফন্ট)",
    fontFamily: "'Tiro Bangla', serif",
    sample: "তায়েফের ঐতিহাসিক ময়দান",
    category: "Serif",
  },
  {
    id: "mina",
    name: "Mina",
    bnName: "মিনা (নরম ও মার্জিত)",
    fontFamily: "'Mina', sans-serif",
    sample: "শান্ত ও প্রশান্তিদায়ক বাণী",
    category: "Sans-Serif",
  },
  {
    id: "galada",
    name: "Galada",
    bnName: "গালাদা (ক্যালিগ্রাফিক স্টাইল)",
    fontFamily: "'Galada', cursive",
    sample: "বিসমিল্লাহির রাহমানির রাহিম",
    category: "Calligraphy",
  },
];

/**
 * Splits Bangla narration text into timed subtitle cues synchronized with audio duration
 */
export function generateAutoSubtitles(text: string, totalDurationSec: number): SubtitleCue[] {
  if (!text || totalDurationSec <= 0) return [];

  // Split by Bengali full stops (।), commas, question marks, newlines or exclamation marks
  const rawSentences = text
    .split(/([।!?\n]+)/)
    .filter(Boolean);

  const mergedSentences: string[] = [];
  let buffer = "";

  for (let i = 0; i < rawSentences.length; i++) {
    const s = rawSentences[i].trim();
    if (!s) continue;
    if (s === "।" || s === "!" || s === "?" || s === "\n") {
      buffer += s;
      if (buffer.trim()) {
        mergedSentences.push(buffer.trim());
        buffer = "";
      }
    } else {
      if (buffer) {
        mergedSentences.push(buffer.trim());
        buffer = "";
      }
      buffer = s;
    }
  }
  if (buffer.trim()) {
    mergedSentences.push(buffer.trim());
  }

  // If sentences are very long (> 12 words), break them into smaller chunk phrases for better video subtitle display
  const chunks: string[] = [];
  mergedSentences.forEach((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= 10) {
      chunks.push(sentence);
    } else {
      // Chunk into 6-8 word pieces
      let temp: string[] = [];
      for (let i = 0; i < words.length; i++) {
        temp.push(words[i]);
        if (temp.length >= 7 || i === words.length - 1) {
          chunks.push(temp.join(" "));
          temp = [];
        }
      }
    }
  });

  if (chunks.length === 0) {
    return [{ id: "cue-0", startTime: 0, endTime: totalDurationSec, text }];
  }

  // Allocate duration proportional to character count
  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
  let currentStart = 0;

  return chunks.map((chunk, index) => {
    const ratio = chunk.length / totalChars;
    // Add small buffer
    const duration = Math.max(1.2, ratio * totalDurationSec);
    const cueStart = currentStart;
    let cueEnd = Math.min(totalDurationSec, currentStart + duration);
    if (index === chunks.length - 1) {
      cueEnd = Math.max(cueEnd, totalDurationSec);
    }
    currentStart = cueEnd;

    return {
      id: `cue-${index}-${cueStart.toFixed(3)}`,
      startTime: parseFloat(cueStart.toFixed(2)),
      endTime: parseFloat(cueEnd.toFixed(2)),
      text: chunk,
    };
  });
}

/**
 * Generate standard WebVTT / SRT subtitle file for export
 */
export function exportToSrt(cues: SubtitleCue[]): string {
  const formatTime = (seconds: number) => {
    const pad = (n: number, z = 2) => ("00" + n).slice(-z);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  };

  return cues
    .map((cue, idx) => {
      return `${idx + 1}\n${formatTime(cue.startTime)} --> ${formatTime(
        cue.endTime
      )}\n${cue.text}\n`;
    })
    .join("\n");
}
