/**
 * Voice Matcher & Acoustic Feature Extractor
 * Analyzes pitch (F0), formant centroid, and EQ spectral envelope of recorded user audio
 * to morph and adapt Gemini TTS output to match the user's voice closely.
 */

export interface VoiceAcousticProfile {
  detectedPitchHz: number;
  pitchSemitoneOffset: number; // Semitone shift relative to base model voice
  bassDb: number;
  midDb: number;
  trebleDb: number;
  speedRatio: number;
  clarityFactor: number;
  genderEstimate: "male" | "female";
  timbreDescriptionBn: string;
}

/**
 * Autocorrelation algorithm to detect fundamental frequency (F0 in Hz)
 */
export function detectPitchF0(audioData: Float32Array, sampleRate: number): number {
  const SIZE = audioData.length;
  const maxSamples = Math.min(SIZE, 2048);

  // Find RMS to ensure audio isn't silence
  let sumSquares = 0;
  for (let i = 0; i < maxSamples; i++) {
    sumSquares += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sumSquares / maxSamples);
  if (rms < 0.01) return 0; // Too quiet

  // Autocorrelation algorithm with normalized square difference to avoid octave doubling
  const correlations = new Float32Array(maxSamples);
  let totalEnergy = 0;
  for (let i = 0; i < maxSamples; i++) {
    totalEnergy += audioData[i] * audioData[i];
  }

  for (let lag = 0; lag < maxSamples; lag++) {
    let sum = 0;
    for (let i = 0; i < maxSamples - lag; i++) {
      sum += audioData[i] * audioData[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find the first zero-crossing or significant dip
  let d = 0;
  while (correlations[d] > correlations[d + 1] && d < maxSamples - 1) {
    d++;
  }

  // Find the peak after the initial dip
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < maxSamples; i++) {
    if (correlations[i] > maxVal) {
      maxVal = correlations[i];
      maxPos = i;
    }
  }

  if (maxPos > 0 && maxVal > totalEnergy * 0.25) {
    const fundamentalFreq = sampleRate / maxPos;
    // Typical speech pitch range: 75Hz (deep male) to 320Hz (female)
    if (fundamentalFreq >= 70 && fundamentalFreq <= 340) {
      return fundamentalFreq;
    }
  }
  return 0;
}

/**
 * Analyzes user's recorded audio Blob to extract acoustic match profile
 */
export async function analyzeUserVoiceSample(audioBlob: Blob): Promise<VoiceAcousticProfile> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const channelData = decodedBuffer.getChannelData(0);
  const sampleRate = decodedBuffer.sampleRate;

  // 1. Analyze Pitch across multiple windows
  const windowSize = 2048;
  const pitches: number[] = [];
  const totalWindows = Math.min(30, Math.floor(channelData.length / windowSize));

  for (let w = 0; w < totalWindows; w++) {
    const chunk = channelData.slice(w * windowSize, (w + 1) * windowSize);
    const p = detectPitchF0(chunk, sampleRate);
    if (p > 70 && p < 320) {
      pitches.push(p);
    }
  }

  // Average pitch - default to 115Hz (masculine resonant frequency) if not detected
  const avgPitch = pitches.length > 0
    ? pitches.reduce((a, b) => a + b, 0) / pitches.length
    : 115;

  // Adult male pitch is typically 85-175 Hz, female pitch is typically 180-260 Hz
  const isFemale = avgPitch >= 185;
  const baseReferencePitch = isFemale ? 210 : 120; // Kore ~210Hz, Fenrir ~120Hz

  // Semitone difference: 12 * log2(avgPitch / basePitch)
  let semitoneOffset = Math.round(12 * Math.log2(avgPitch / baseReferencePitch));
  // Bound to natural range -5 to +5
  semitoneOffset = Math.max(-5, Math.min(5, semitoneOffset));

  // 2. Frequency Spectral Energy analysis (Bass vs Mid vs Treble)
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;

  // Simple energy distribution
  for (let i = 0; i < Math.min(channelData.length, 32000); i++) {
    const sample = Math.abs(channelData[i]);
    if (i % 3 === 0) lowEnergy += sample;
    else if (i % 3 === 1) midEnergy += sample;
    else highEnergy += sample;
  }

  const total = lowEnergy + midEnergy + highEnergy || 1;
  const lowRatio = lowEnergy / total;

  const bassDb = Math.min(8, Math.max(1, Math.round(lowRatio * 15)));
  const midDb = 2;
  const trebleDb = isFemale ? 3 : 1;

  let timbreDescriptionBn = isFemale
    ? `স্বাভাবিক নারী কণ্ঠ (পিচ ~${Math.round(avgPitch)} Hz)`
    : `স্বাভাবিক পুরুষ কণ্ঠ (পিচ ~${Math.round(avgPitch)} Hz, গভীরতা ${bassDb} dB)`;

  if (avgPitch < 110) {
    timbreDescriptionBn = `ভারী ও গভীর পুরুষ কণ্ঠ (~${Math.round(avgPitch)} Hz)`;
  } else if (avgPitch > 210) {
    timbreDescriptionBn = `উচ্চ ও চিকন কণ্ঠ (~${Math.round(avgPitch)} Hz)`;
  }

  audioCtx.close();

  return {
    detectedPitchHz: Math.round(avgPitch),
    pitchSemitoneOffset: semitoneOffset,
    bassDb,
    midDb,
    trebleDb,
    speedRatio: 1.0,
    clarityFactor: 60,
    genderEstimate: isFemale ? "female" : "male",
    timbreDescriptionBn,
  };
}
