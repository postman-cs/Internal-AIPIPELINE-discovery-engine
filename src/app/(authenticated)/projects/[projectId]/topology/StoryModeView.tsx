"use client";

import { useState, useMemo, useCallback } from "react";
import {
  generateOutline,
  type StoryBeat,
} from "@/lib/story/outline";
import { computeRiskScores, type TopoNode, type TopoEdge } from "@/lib/topology/riskScoring";
import { polishStoryOutline } from "@/lib/actions/story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StoryModeViewProps {
  nodes: TopoNode[];
  edges: TopoEdge[];
  projectId: string;
  /** Callback to highlight specific nodes/edges in the constellation */
  onHighlight?: (highlight: { nodeIds: string[]; edgeIds: string[] } | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoryModeView({
  nodes,
  edges,
  projectId,
  onHighlight,
}: StoryModeViewProps) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isPresentation, setIsPresentation] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishedData, setPolishedData] = useState<{
    talkTrack: string;
    beatNotes: Map<string, string>;
  } | null>(null);

  // Generate outline
  const scores = useMemo(() => computeRiskScores(nodes, edges), [nodes, edges]);
  const outline = useMemo(() => generateOutline(nodes, edges, scores), [nodes, edges, scores]);
  const beats = outline.beats;
  const beat = beats[currentBeat] ?? null;

  // Highlight current beat
  const updateHighlight = useCallback(
    (b: StoryBeat | null) => {
      onHighlight?.(b ? b.highlight : null);
    },
    [onHighlight]
  );

  // Navigation
  const goNext = useCallback(() => {
    const next = Math.min(currentBeat + 1, beats.length - 1);
    setCurrentBeat(next);
    updateHighlight(beats[next]);
  }, [currentBeat, beats, updateHighlight]);

  const goPrev = useCallback(() => {
    const prev = Math.max(currentBeat - 1, 0);
    setCurrentBeat(prev);
    updateHighlight(beats[prev]);
  }, [currentBeat, beats, updateHighlight]);

  const goTo = useCallback(
    (i: number) => {
      setCurrentBeat(i);
      updateHighlight(beats[i]);
    },
    [beats, updateHighlight]
  );

  // Polish handler
  const handlePolish = useCallback(async () => {
    setPolishing(true);
    try {
      const result = await polishStoryOutline(projectId, outline);
      if ("error" in result && result.error) {
        console.error("Story polish failed:", result.error);
        return;
      }
      if ("beats" in result) {
        const beatMap = new Map<string, string>();
        for (const b of result.beats) {
          beatMap.set(b.id, b.polishedSpeakerNotes);
        }
        setPolishedData({ talkTrack: result.talkTrack, beatNotes: beatMap });
      }
    } catch (err) {
      console.error("Story polish failed:", err);
    } finally {
      setPolishing(false);
    }
  }, [projectId, outline]);

  // Speaker notes for current beat
  const speakerNotes =
    polishedData?.beatNotes.get(beat?.id ?? "") ?? beat?.speakerNotes ?? "";

  if (beats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <p className="text-gray-500 text-sm">No story outline available — need topology data first.</p>
      </div>
    );
  }

  // Presentation mode
  if (isPresentation) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
        {/* Minimal chrome */}
        <div className="flex items-center justify-between px-8 py-4">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">
            {currentBeat + 1} / {beats.length}
          </span>
          <button
            onClick={() => setIsPresentation(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Exit Presentation
          </button>
        </div>

        {/* Beat content */}
        <div className="flex-1 flex flex-col items-center justify-center px-16 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-100 mb-4">{beat?.headline}</h1>
          <p className="text-base text-gray-400 mb-8 text-center">{beat?.objective}</p>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 w-full">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{speakerNotes}</p>
          </div>
          {beat && beat.evidenceIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-4">
              {beat.evidenceIds.map((id) => (
                <span key={id} className="text-[10px] bg-blue-900/20 text-blue-400 px-1.5 py-0.5 rounded">
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-center gap-4 px-8 py-6">
          <button
            onClick={goPrev}
            disabled={currentBeat === 0}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm disabled:opacity-30 transition-colors"
          >
            Back
          </button>
          <div className="flex gap-1.5">
            {beats.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentBeat ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600"
                }`}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={currentBeat === beats.length - 1}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // Normal mode
  return (
    <div className="flex flex-1 min-h-0 bg-gray-950">
      {/* Beat list (left) */}
      <div className="w-64 border-r border-gray-800 overflow-y-auto bg-gray-900/50">
        <div className="p-3 border-b border-gray-800">
          <h3 className="text-xs font-bold text-gray-200 mb-1">Guided Walkthrough</h3>
          <p className="text-[10px] text-gray-500">{outline.title}</p>
        </div>
        <div className="p-2 space-y-1">
          {beats.map((b, i) => (
            <button
              key={b.id}
              onClick={() => goTo(i)}
              className={`w-full text-left rounded-lg p-2.5 transition-colors ${
                i === currentBeat
                  ? "bg-blue-900/30 border border-blue-800/40"
                  : "hover:bg-gray-800/50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === currentBeat
                      ? "bg-blue-600 text-white"
                      : i < currentBeat
                      ? "bg-gray-700 text-gray-400"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-xs font-medium ${
                    i === currentBeat ? "text-blue-300" : "text-gray-400"
                  }`}
                >
                  {b.headline}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current beat content (center) */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
              Beat {currentBeat + 1} of {beats.length}
            </div>
            <h2 className="text-xl font-bold text-gray-100">{beat?.headline}</h2>
            <p className="text-sm text-gray-400 mt-1">{beat?.objective}</p>
          </div>

          {/* Speaker notes */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Speaker Notes {polishedData?.beatNotes.has(beat?.id ?? "") ? "(AI Polished)" : "(Auto)"}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(speakerNotes)}
                className="text-[10px] text-gray-500 hover:text-gray-300"
              >
                Copy
              </button>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {speakerNotes}
            </p>
          </div>

          {/* Evidence */}
          {beat && beat.evidenceIds.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-2">
                Citations
              </span>
              <div className="flex flex-wrap gap-1">
                {[...new Set(beat.evidenceIds)].map((id) => (
                  <span
                    key={id}
                    className="text-[10px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded border border-blue-800/30"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Highlighted components */}
          {beat && (beat.highlight.nodeIds.length > 0 || beat.highlight.edgeIds.length > 0) && (
            <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-800/50">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-1">
                Highlighted in Constellation
              </span>
              <div className="text-xs text-gray-400">
                {beat.highlight.nodeIds.length > 0 && (
                  <span>{beat.highlight.nodeIds.length} node(s)</span>
                )}
                {beat.highlight.edgeIds.length > 0 && (
                  <span className="ml-2">{beat.highlight.edgeIds.length} edge(s)</span>
                )}
              </div>
            </div>
          )}

          {/* Talk track (if polished) */}
          {polishedData?.talkTrack && (
            <div className="bg-purple-900/10 border border-purple-800/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">
                  Full Talk Track (2-3 min)
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(polishedData.talkTrack)}
                  className="text-[10px] text-purple-400 hover:text-purple-300"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {polishedData.talkTrack}
              </p>
            </div>
          )}

          {/* Navigation + actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={currentBeat === 0}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs disabled:opacity-30 transition-colors"
              >
                Back
              </button>
              <button
                onClick={goNext}
                disabled={currentBeat === beats.length - 1}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePolish}
                disabled={polishing}
                className="px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-800/40 rounded-lg text-xs disabled:opacity-50 transition-colors"
              >
                {polishing ? "Polishing..." : polishedData ? "Re-polish (AI)" : "Polish Narrative (AI)"}
              </button>
              <button
                onClick={() => {
                  updateHighlight(beat);
                  setIsPresentation(true);
                }}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                Presentation View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
