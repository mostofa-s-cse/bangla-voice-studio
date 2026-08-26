import { pcmToWavBlob } from "./audioHelper";

/**
 * Creates an impulse response buffer for realistic studio or hall ambience.
 */
function createReverbImpulse(
  ctx: BaseAudioContext,
  duration = 1.2,
  decay = 2.0,
  reverse = false
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = reverse ? length - i : i;
    const factor = Math.pow(1 - n / length, decay);
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }

  return impulse;
}

/**
 * Converts an AudioBuffer to 16-bit linear PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // Interleave channels if stereo or keep mono
  const isMono = numChannels === 1;
  const pcmLength = length * numChannels * 2; // 2 bytes per 16-bit sample
  const pcmBytes = new Uint8Array(pcmLength);
  const view = new DataView(pcmBytes.buffer);

  let offset = 0;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channelData[c][i];
      // Hard clipping / safety
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return pcmToWavBlob(pcmBytes, sampleRate, numChannels, 16);
}

export interface DspEffectOptions {
  pitchSemitones?: number; // -12 to +12
  speed?: number; // 0.7 to 1.5
  bassBoostDb?: number; // 0 to 12 dB
  reverbPercent?: number; // 0 to 100%
  warmthPercent?: number; // 0 to 100%
}

/**
 * Applies studio-grade DSP (Pitch, Bass Boost, Studio Warmth, Reverb) to an audio Blob
 * using OfflineAudioContext for deterministic, artifact-free processing.
 */
export async function applyDspEffectsToBlob(
  sourceWavBlob: Blob,
  options: DspEffectOptions
): Promise<Blob> {
  const {
    pitchSemitones = 0,
    speed = 1.0,
    bassBoostDb = 0,
    reverbPercent = 0,
    warmthPercent = 0,
  } = options;

  // If no effects are requested, return original blob
  if (
    pitchSemitones === 0 &&
    speed === 1.0 &&
    bassBoostDb === 0 &&
    reverbPercent === 0 &&
    warmthPercent === 0
  ) {
    return sourceWavBlob;
  }

  const arrayBuffer = await sourceWavBlob.arrayBuffer();
  // Standard AudioContext for decoding
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Pitch calculation: 2^(semitones / 12)
  const pitchMultiplier = Math.pow(2, pitchSemitones / 12);
  const totalPlaybackRate = pitchMultiplier * speed;

  // New buffer length based on playback speed/pitch
  const outSampleRate = decodedBuffer.sampleRate;
  const outLength = Math.ceil(decodedBuffer.length / totalPlaybackRate);

  // Offline context for rendering
  const offlineCtx = new OfflineAudioContext(
    2, // Stereo output
    outLength + Math.ceil(outSampleRate * 1.5), // Extra headroom for reverb tail
    outSampleRate
  );

  // 1. Source Node
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.playbackRate.value = totalPlaybackRate;

  // 2. Bass Boost Filter (Low-shelf at 120Hz)
  const bassFilter = offlineCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 120;
  bassFilter.gain.value = bassBoostDb;

  // 3. Warmth / Presence Filter (Peaking at 2.4kHz & subtle mid warm)
  const warmthFilter = offlineCtx.createBiquadFilter();
  warmthFilter.type = "peaking";
  warmthFilter.frequency.value = 2400;
  warmthFilter.gain.value = (warmthPercent / 100) * 4; // Up to +4dB warmth
  warmthFilter.Q.value = 1.2;

  // 4. Reverb Setup (Dry / Wet mixing)
  const dryGain = offlineCtx.createGain();
  const wetGain = offlineCtx.createGain();

  const wetRatio = Math.max(0, Math.min(1, reverbPercent / 100)) * 0.45; // max 45% wet
  const dryRatio = 1.0 - wetRatio * 0.5;

  dryGain.gain.value = dryRatio;
  wetGain.gain.value = wetRatio;

  const convolver = offlineCtx.createConvolver();
  convolver.buffer = createReverbImpulse(offlineCtx, 1.4, 2.2);

  // Connect graph:
  // Source -> BassFilter -> WarmthFilter -> DryGain -> Destination
  //                                     -> Convolver -> WetGain -> Destination
  source.connect(bassFilter);
  bassFilter.connect(warmthFilter);

  warmthFilter.connect(dryGain);
  dryGain.connect(offlineCtx.destination);

  if (reverbPercent > 0) {
    warmthFilter.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(offlineCtx.destination);
  }

  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  audioCtx.close();

  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Converts a Blob to Base64 data string (excluding prefix)
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
