/**
 * AI clients — embeddings (Voyage AI) and LLM provider (OpenAI/Anthropic).
 *
 * Embeddings use Voyage AI (free tier: 200M tokens/month).
 * For multi-model routing (OpenAI + Anthropic), see model-router.ts.
 */

import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as { openai: OpenAI };

export const openai =
  globalForOpenAI.openai ||
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (process.env.NODE_ENV !== "production") globalForOpenAI.openai = openai;

export const EMBEDDING_MODEL = "voyage-3-lite";
export const EMBEDDING_DIMENSIONS = 512;

/** @deprecated Use model-router.ts selectModel() instead */
export const LLM_MODEL = "gpt-4.1";

/**
 * Generate embeddings via Voyage AI.
 * Returns an array of float arrays, one per input text.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set. Add it to your environment variables.");
  }

  // Voyage AI free tier (no payment method) = 3 RPM. Retry on 429.
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (response.status !== 429) break;
    // Wait before retry: 20s, 40s
    const wait = (attempt + 1) * 20_000;
    console.warn(`[embeddings] Rate limited (429), retrying in ${wait / 1000}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }

  if (!response || !response.ok) {
    const body = response ? await response.text() : "No response";
    throw new Error(`Voyage AI embedding failed (${response?.status}): ${body}`);
  }

  const json = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Hash a prompt string for deduplication / audit.
 */
export function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const chr = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return Math.abs(hash).toString(36);
}
