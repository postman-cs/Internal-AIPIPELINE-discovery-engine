/**
 * Story Polisher Agent
 *
 * Takes a deterministic story outline and evidence, returns a polished
 * talk track with per-beat speaker notes. Strictly evidence-cited.
 */

import { z } from "zod";
import { runAgent } from "./runner";
import type { StoryOutline } from "@/lib/story/outline";

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export const storyPolisherOutputSchema = z.object({
  talkTrack: z.string().describe("Full 2-3 minute executive narrative"),
  beats: z.array(
    z.object({
      id: z.string(),
      polishedSpeakerNotes: z.string(),
    })
  ),
});

export type StoryPolisherOutput = z.infer<typeof storyPolisherOutputSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior Solutions Engineer at Postman preparing a customer topology walkthrough.

Your task: Take the raw story outline and polish the speaker notes into a concise, professional narrative.

RULES:
- Do NOT invent facts. Only reference information from the provided outline and evidence excerpts.
- Every major claim must cite at least one evidenceId in brackets like [EVIDENCE-1].
- The talkTrack should be 2-3 minutes when read aloud (~350-500 words).
- Each beat's polishedSpeakerNotes should be 2-4 sentences, conversational but precise.
- Maintain the beat structure exactly (same IDs, same order).
- Output valid JSON matching the schema exactly.`;

export async function runStoryPolisher(
  projectId: string,
  outline: StoryOutline,
  evidenceExcerpts: { id: string; excerpt: string; source: string }[]
): Promise<StoryPolisherOutput> {
  const userPrompt = `## Story Outline

Title: ${outline.title}

### Beats
${outline.beats
  .map(
    (b) => `#### ${b.id}: ${b.headline}
Objective: ${b.objective}
Speaker Notes (raw): ${b.speakerNotes}
Evidence IDs: ${b.evidenceIds.join(", ") || "none"}`
  )
  .join("\n\n")}

## Available Evidence Excerpts
${evidenceExcerpts
  .map((e) => `- ${e.id} (${e.source}): "${e.excerpt}"`)
  .join("\n")}

Return JSON with:
- talkTrack: a flowing 2-3 minute narrative referencing the beats
- beats: array of { id, polishedSpeakerNotes } for each beat above`;

  const result = await runAgent({
    agentType: "storyPolisher",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: storyPolisherOutputSchema,
  });

  return result.output;
}
