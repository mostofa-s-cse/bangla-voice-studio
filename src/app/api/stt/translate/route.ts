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
                "Translate the following Bengali (Bangla) text into natural, fluent English. " +
                "Return only the English translation — no notes, no quotes, no commentary.\n\n" +
                text.trim(),
            },
          ],
        },
      ],
    });

    const translation = (response.text || "").trim();

    if (!translation) {
      console.error("Translation returned empty text. Full response:", JSON.stringify(response, null, 2));
      return NextResponse.json(
        { error: "অনুবাদ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      translation,
    });
  } catch (error) {
    console.error("Translation Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to translate text" },
      { status: 500 }
    );
  }
}
