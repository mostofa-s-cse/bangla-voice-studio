export interface VoiceOption {
  id: string;
  name: string;
  bnName: string;
  gender: "female" | "male";
  styleBn: string;
  description: string;
  avatarColor: string;
}

export type ToneStyle = "reverent" | "storyteller" | "formal" | "custom";

export interface CustomVoiceProfile {
  id: string;
  name: string;
  baseVoice: string; // "Kore" | "Fenrir" | "Puck" | "Charon" | "Zephyr"
  gender: "female" | "male";
  pitchSemitones: number; // -12 to +12 semitones
  speed: number; // 0.7 to 1.4
  bassBoost: number; // 0 to 12 dB
  reverbAmount: number; // 0 to 100%
  warmth: number; // 0 to 100%
  customInstruction: string;
  referenceAudioName?: string;
  referenceAudioUrl?: string;
  createdAt: number;
}

export interface StoryPreset {
  id: string;
  title: string;
  category: string;
  text: string;
  description: string;
}

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface VideoSubtitleStyle {
  fontFamily: string;
  fontSize: number; // in px
  color: string;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: "bottom" | "middle" | "top";
  animation: "none" | "fade" | "pop" | "karaoke";
  bgOpacity: number;
}

export interface GeneratedAudioItem {
  id: string;
  timestamp: number;
  text: string;
  voice: string;
  tone: ToneStyle;
  blobUrl: string;
  duration: number;
  wavBlob: Blob;
  title: string;
  customProfileName?: string;
}
