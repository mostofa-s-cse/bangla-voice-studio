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
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "অনুগ্রহ করে টেক্সট প্রদান করুন (Text is required)" },
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
              text:
                "The text below may be written in Bangla (Bengali) script, or in Banglish " +
                "(Bengali words spelled phonetically with English/Roman letters). " +
                "Convert it to natural, correctly spelled Bangla (Bengali) script. " +
                "If it is already in Bangla script, only fix obvious typos and keep the meaning unchanged. " +
                "Preserve the original meaning, tone, and line breaks exactly. " +
                "Return only the Bangla text — no notes, no quotes, no commentary.\n\n" +
                text.trim(),
            },
          ],
        },
      ],
    });

    const banglaText = (response.text || "").trim();

    if (!banglaText) {
      console.error("Transliteration returned empty text. Full response:", JSON.stringify(response, null, 2));
      return NextResponse.json(
        { error: "বাংলায় রূপান্তর করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      banglaText,
    });
  } catch (error) {
    console.error("Transliteration Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to transliterate text" },
      { status: 500 }
    );
  }
}
