# Bangla Voice Studio

Bangla Text-to-Speech voice generator with custom voice cloning and a video subtitle-sync studio, built on Next.js (App Router) and Google Gemini TTS.

Originally a Vite + Express app ([Text-To-Voice-Genarator](https://github.com/mostofa-s-cse/Text-To-Voice-Genarator)), ported to Next.js.

## Features

- Generate Bengali narration audio from Hadith/history text or your own text, with selectable base voices and narration tones (reverent, storyteller, formal)
- **Voice Cloning & Matching** — record or upload a reference voice sample; client-side pitch/formant analysis (autocorrelation-based F0 detection) plus a Gemini audio analysis pass auto-tunes pitch, bass, and narration style to match
- **Studio DSP effects** — pitch shift, speed, bass boost, reverb, warmth, applied client-side via the Web Audio API
- **Video Voice Sync Studio** — upload or pick a sample video, sync the generated voice to playback, auto-generate timed Bangla subtitles, pick from several Bangla fonts, customize subtitle styling, and export an `.srt` file
- Custom voice profiles saved to `localStorage`, plus recent-generation history

## Stack

Next.js 16 (App Router, TypeScript, Tailwind CSS v4), React 19, `@google/genai` (Gemini TTS), `motion`, `lucide-react`.

## Getting Started

```bash
npm install
```

Set your Gemini API key in `.env.local`:

```bash
GEMINI_API_KEY="your-key-here"
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Routes

- `GET /api/health` — status check
- `POST /api/tts/generate` — generate narration audio (text, voice, tone/custom instruction)
- `POST /api/tts/analyze-voice` — analyze a reference audio sample and suggest matching voice settings

`GEMINI_API_KEY` is read server-side only and never exposed to the client.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the project
