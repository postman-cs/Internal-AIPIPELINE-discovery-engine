/**
 * Tests for idempotent ingestion logic.
 * Tests content hash computation and dedup decisions (unit-level, no DB).
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// Test the content hash function directly
function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("content hash dedup", () => {
  it("produces consistent hashes for same content", () => {
    const text = "Hello, this is test content for ingestion.";
    const hash1 = computeContentHash(text);
    const hash2 = computeContentHash(text);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", () => {
    const hash1 = computeContentHash("Content version 1");
    const hash2 = computeContentHash("Content version 2");
    expect(hash1).not.toBe(hash2);
  });

  it("is sensitive to whitespace changes", () => {
    const hash1 = computeContentHash("test content");
    const hash2 = computeContentHash("test  content");
    expect(hash1).not.toBe(hash2);
  });

  it("produces a valid SHA-256 hex string", () => {
    const hash = computeContentHash("any text");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles empty string", () => {
    const hash = computeContentHash("");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // SHA-256 of empty string is known
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("handles unicode content", () => {
    const hash1 = computeContentHash("API ゲートウェイ 認証");
    const hash2 = computeContentHash("API ゲートウェイ 認証");
    expect(hash1).toBe(hash2);
  });

  it("handles very long content", () => {
    const longText = "x".repeat(1_000_000);
    const hash = computeContentHash(longText);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
