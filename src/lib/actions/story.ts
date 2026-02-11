"use server";

import { requireAuth } from "@/lib/session";
import { runStoryPolisher } from "@/lib/ai/agents/storyPolisher";
import { prisma } from "@/lib/prisma";
import type { StoryOutline } from "@/lib/story/outline";

/**
 * Server action: Polish a story outline with the LLM agent.
 * Returns polished talk track + beats.
 */
export async function polishStoryOutline(
  projectId: string,
  outline: StoryOutline
) {
  await requireAuth();

  // Gather evidence excerpts for all referenced evidence IDs
  const allEvidenceIds = Array.from(
    new Set(outline.beats.flatMap((b) => b.evidenceIds))
  );

  const chunks = await prisma.documentChunk.findMany({
    where: {
      evidenceLabel: { in: allEvidenceIds },
      document: { projectId },
    },
    select: {
      evidenceLabel: true,
      content: true,
      document: { select: { sourceType: true } },
    },
    take: 30,
  });

  const excerpts = chunks.map((c) => ({
    id: c.evidenceLabel,
    excerpt: c.content.slice(0, 200),
    source: c.document.sourceType,
  }));

  const result = await runStoryPolisher(projectId, outline, excerpts);
  return result;
}
