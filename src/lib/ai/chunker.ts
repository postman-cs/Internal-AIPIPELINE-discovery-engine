/**
 * Text chunker: splits text into chunks of ~800-1200 tokens with 200-token overlap.
 *
 * Uses sentence-boundary-aware splitting.
 * Token estimation: 1 token ≈ 4 characters (standard English approximation).
 */

const CHARS_PER_TOKEN = 4;
const MIN_CHUNK_TOKENS = 800;
const MAX_CHUNK_TOKENS = 1200;
const OVERLAP_TOKENS = 200;

const MIN_CHUNK_CHARS = MIN_CHUNK_TOKENS * CHARS_PER_TOKEN;
const MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

/** Sentence-boundary regex: split after . ! ? followed by whitespace */
const SENTENCE_RE = /(?<=[.!?])\s+/;

export interface TextChunk {
  content: string;
  tokenCount: number;
  startOffset: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Chunk text into segments of ~800-1200 tokens with 200-token overlap.
 * Respects sentence boundaries when possible.
 */
export function chunkText(text: string): TextChunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If text fits in a single chunk, return as-is
  if (trimmed.length <= MAX_CHUNK_CHARS) {
    return [
      {
        content: trimmed,
        tokenCount: estimateTokens(trimmed),
        startOffset: 0,
      },
    ];
  }

  const sentences = trimmed.split(SENTENCE_RE);
  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let chunkStart = 0;
  let globalOffset = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const candidate = currentChunk
      ? currentChunk + " " + sentence
      : sentence;

    if (candidate.length > MAX_CHUNK_CHARS && currentChunk.length >= MIN_CHUNK_CHARS) {
      // Flush current chunk
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: estimateTokens(currentChunk.trim()),
        startOffset: chunkStart,
      });

      // Compute overlap: take last OVERLAP_CHARS from current chunk
      const overlapStart = Math.max(0, currentChunk.length - OVERLAP_CHARS);
      const overlap = currentChunk.slice(overlapStart);
      chunkStart = globalOffset - overlap.length;
      currentChunk = overlap + " " + sentence;
    } else {
      currentChunk = candidate;
    }

    globalOffset += sentence.length + 1; // +1 for the space
  }

  // Flush remaining
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      tokenCount: estimateTokens(currentChunk.trim()),
      startOffset: chunkStart,
    });
  }

  return chunks;
}
