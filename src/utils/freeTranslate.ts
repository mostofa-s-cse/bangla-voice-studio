/**
 * No-AI translation fallback via the free MyMemory API (no key required).
 * Used when the Gemini translation call fails (quota/limit/outage).
 */

const MYMEMORY_MAX_CHARS = 450;

function chunkBengaliText(text: string): string[] {
  const sentences = text.split(/(?<=।|\?|!)\s*/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > MYMEMORY_MAX_CHARS && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

async function translateChunk(chunk: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    chunk
  )}&langpair=bn|en`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("MyMemory translation request failed");
  }
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || typeof translated !== "string") {
    throw new Error("MyMemory returned no translation");
  }
  return translated;
}

/**
 * Translates Bengali text to English without using Gemini/AI quota.
 * Splits long text into chunks to respect MyMemory's per-request length limit.
 */
export async function translateBengaliToEnglishFree(text: string): Promise<string> {
  const chunks = chunkBengaliText(text.trim());
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    translatedChunks.push(await translateChunk(chunk));
  }

  return translatedChunks.join(" ");
}
