import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      voice = "Kore",
      tone = "reverent",
      customInstruction = "",
    } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে টেক্সট প্রদান করুন (Text is required)" },
        { status: 400 }
      );
    }

    const ai = getGeminiClient();

    // Formulate expressive tone instruction
    let promptInstruction = "";
    if (customInstruction && customInstruction.trim()) {
      promptInstruction = `Narration Style & Personality: ${customInstruction.trim()}.\nEnsure natural Bengali pronunciation and respectful cadence:`;
    } else if (tone === "reverent") {
      promptInstruction = "Read this Bengali text in a respectful, heartfelt, calm, and emotionally moving narration style:";
    } else if (tone === "storyteller") {
      promptInstruction = "Narrate this Bengali story with warm, expressive, and engaging storytelling emotions:";
    } else if (tone === "formal") {
      promptInstruction = "Read clearly in standard formal Bengali with accurate pronunciation and steady pacing:";
    } else {
      promptInstruction = "Read clearly and naturally in Bengali:";
    }

    const prompt = `${promptInstruction}\n\n${text.trim()}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const base64Audio = audioPart?.data;
    const mimeType = audioPart?.mimeType || "audio/pcm;rate=24000";

    if (!base64Audio) {
      return NextResponse.json(
        { error: "মডেল থেকে কোনো অডিও ডেটা পাওয়া যায়নি (No audio data returned from Gemini TTS)." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audioBase64: base64Audio,
      mimeType,
      sampleRate: 24000,
      voice,
    });
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate Bangla audio" },
      { status: 500 }
    );
  }
}
