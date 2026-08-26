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

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json(
        { error: "অনুগ্রহ করে অডিও প্রদান করুন (Audio is required)" },
        { status: 400 }
      );
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
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
            {
              text:
                "Transcribe this Bengali (Bangla) speech audio exactly as spoken, word for word, in Bengali script. " +
                "Do not translate, summarize, or add any commentary — return only the raw Bengali transcript text.",
            },
          ],
        },
      ],
    });

    const transcript = (response.text || "").trim();

    if (!transcript) {
      console.error("Transcription returned empty text. Full response:", JSON.stringify(response, null, 2));
      return NextResponse.json(
        { error: "অডিও থেকে কোনো টেক্সট শনাক্ত করা যায়নি। অনুগ্রহ করে স্পষ্ট অডিও দিয়ে আবার চেষ্টা করুন।" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error("Transcription Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
