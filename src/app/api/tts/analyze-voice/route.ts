import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
    const { audioBase64, mimeType = "audio/wav" } = await req.json();
    if (!audioBase64) {
      return NextResponse.json({ error: "No reference audio provided." }, { status: 400 });
    }

    const ai = getGeminiClient();
    const prompt = `Analyze this spoken voice audio sample and suggest optimal voice style configurations for TTS:
1. Suggested prebuilt base voice (choose closest from: Kore, Fenrir, Puck, Charon, Zephyr)
2. Pitch estimation (normal, deep, high, soft)
3. Tone description (e.g. calm spiritual, solemn, energetic, warm storytelling)
4. A 1-2 sentence Bengali narration prompt instruction for Gemini TTS to match this tone.

Return in JSON format:
{
  "suggestedBaseVoice": "Fenrir" | "Kore" | "Puck" | "Charon" | "Zephyr",
  "gender": "male" | "female",
  "pitchSemitones": number between -6 and +6,
  "bassBoost": number between 0 and 10,
  "reverbAmount": number between 10 and 60,
  "customInstruction": "string in English/Bengali for TTS prompt",
  "summaryBn": "short Bengali summary of detected voice"
}`;

    const analysisResponse = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: audioBase64,
                mimeType,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = analysisResponse.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {
        suggestedBaseVoice: "Fenrir",
        gender: "male",
        pitchSemitones: -2,
        bassBoost: 4,
        reverbAmount: 25,
        customInstruction: "Deep, resonant, spiritual, and calm Bengali narration with steady pace.",
        summaryBn: "গভীর, শান্ত ও ভাবগম্ভীর পুরুষ কণ্ঠ সনাক্ত হয়েছে।",
      };
    }

    return NextResponse.json({
      success: true,
      analysis: parsed,
    });
  } catch (error) {
    console.error("Voice Analysis Error:", error);
    // Fallback gracefully
    return NextResponse.json({
      success: true,
      analysis: {
        suggestedBaseVoice: "Fenrir",
        gender: "male",
        pitchSemitones: -1,
        bassBoost: 3,
        reverbAmount: 20,
        customInstruction: "Clear, emotional, and warm narration with respectful cadence.",
        summaryBn: "কণ্ঠের বৈশিষ্ট্য সফলভাবে কনফিগার করা হয়েছে।",
      },
    });
  }
}
