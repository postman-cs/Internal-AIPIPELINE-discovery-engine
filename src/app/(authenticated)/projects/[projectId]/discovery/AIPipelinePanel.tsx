"use client";

import { useState, useTransition } from "react";
import {
  ingestDiscoveryDocument,
  runAIDiscoveryPipeline,
} from "@/lib/actions/discovery";
import { useRouter } from "next/navigation";

interface AIPipelinePanelProps {
  projectId: string;
  evidenceStats: { docCount: number; chunkCount: number };
  hasArtifact: boolean;
  latestVersion: number;
}

const SOURCE_TYPES = [
  { value: "KEPLER", label: "Kepler Intelligence" },
  { value: "DNS", label: "DNS Findings" },
  { value: "HEADERS", label: "HTTP Header Analysis" },
  { value: "GITHUB", label: "GitHub / Engineering" },
  { value: "MANUAL", label: "Manual Notes / Other" },
  { value: "CALL_TRANSCRIPT", label: "Call Transcript" },
  { value: "SLACK", label: "Slack Messages" },
  { value: "GMAIL", label: "Email Thread" },
];

const PIPELINE_STEPS = [
  { key: "recon", label: "Recon Synthesis", description: "Analyzing raw intelligence..." },
  { key: "signals", label: "Signal Classification", description: "Classifying technical signals..." },
  { key: "maturity", label: "Maturity Scoring", description: "Scoring API maturity..." },
  { key: "hypothesis", label: "Hypothesis Generation", description: "Generating engagement hypothesis..." },
  { key: "brief", label: "Brief Generation", description: "Compiling Discovery Brief..." },
];

export function AIPipelinePanel({
  projectId,
  evidenceStats,
  hasArtifact,
  latestVersion,
}: AIPipelinePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Ingest state
  const [ingestSource, setIngestSource] = useState("KEPLER");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestMsg, setIngestMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Pipeline state
  const [pipelineMsg, setPipelineMsg] = useState<{
    type: "success" | "error" | "running";
    text: string;
  } | null>(null);

  const handleIngest = () => {
    if (!ingestContent.trim()) {
      setIngestMsg({ type: "error", text: "Content is required" });
      return;
    }

    startTransition(async () => {
      setIngestMsg(null);
      const result = await ingestDiscoveryDocument(
        projectId,
        ingestSource,
        ingestTitle.trim() || `${ingestSource} document`,
        ingestContent
      );

      if (result.error) {
        setIngestMsg({ type: "error", text: result.error });
      } else {
        const cascadeNote = result.impactedPhases && result.impactedPhases.length > 0
          ? ` Cascade: ${result.impactedPhases.length} phases impacted.`
          : "";
        setIngestMsg({
          type: "success",
          text: `Ingested: ${result.chunkCount} chunks, labels ${result.evidenceLabels?.[0]}–${result.evidenceLabels?.[result.evidenceLabels.length - 1]}.${cascadeNote}`,
        });
        setIngestTitle("");
        setIngestContent("");
        router.refresh();
      }
    });
  };

  const handleRunPipeline = () => {
    startTransition(async () => {
      setPipelineMsg({
        type: "running",
        text: "Running 5-agent pipeline... This may take 30-60 seconds.",
      });

      const result = await runAIDiscoveryPipeline(projectId);

      if (result.error) {
        setPipelineMsg({ type: "error", text: result.error });
      } else {
        setPipelineMsg({
          type: "success",
          text: `Discovery Brief v${result.version} generated! ${result.agentRuns} agent runs, ${result.citationCount} citations, ${result.validatedEvidenceIds ?? 0} validated evidence IDs.`,
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Evidence Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-[#ff6c37]">
            {evidenceStats.docCount}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            Source
            <br />
            Documents
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-blue-600">
            {evidenceStats.chunkCount}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            Evidence
            <br />
            Chunks
          </span>
        </div>
        {hasArtifact && (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
            <span className="text-2xl font-bold text-green-600">
              v{latestVersion}
            </span>
            <span className="text-xs text-gray-500 leading-tight">
              Latest
              <br />
              Brief
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingest Evidence Panel */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            1. Ingest Evidence
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Paste intelligence data — it will be chunked, embedded, and stored
            as citable evidence.
          </p>

          {ingestMsg && (
            <div
              className={`text-sm rounded-lg px-3 py-2 mb-3 ${
                ingestMsg.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}
            >
              {ingestMsg.text}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Source Type</label>
                <select
                  value={ingestSource}
                  onChange={(e) => setIngestSource(e.target.value)}
                  className="input-field text-sm"
                >
                  {SOURCE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Title (optional)</label>
                <input
                  type="text"
                  value={ingestTitle}
                  onChange={(e) => setIngestTitle(e.target.value)}
                  className="input-field text-sm"
                  placeholder="e.g. Kepler report Q1"
                />
              </div>
            </div>
            <div>
              <label className="label">Content</label>
              <textarea
                value={ingestContent}
                onChange={(e) => setIngestContent(e.target.value)}
                className="input-field text-sm resize-y font-mono"
                style={{ minHeight: "160px" }}
                placeholder="Paste raw intelligence: Kepler data, DNS findings, HTTP header analysis, call transcripts, meeting notes, etc."
              />
            </div>
            <button
              onClick={handleIngest}
              disabled={isPending || !ingestContent.trim()}
              className="btn-primary w-full disabled:opacity-50 text-sm"
            >
              {isPending ? "Ingesting..." : "Ingest & Embed"}
            </button>
          </div>
        </div>

        {/* AI Pipeline Panel */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            2. Run AI Pipeline
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Run the 5-agent discovery pipeline over all ingested evidence to
            generate an evidence-cited Discovery Brief.
          </p>

          {/* Pipeline steps visualization */}
          <div className="space-y-2 mb-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={step.key}
                className="flex items-center gap-3 text-xs"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    pipelineMsg?.type === "running"
                      ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 animate-pulse"
                      : pipelineMsg?.type === "success"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  }`}
                >
                  {i + 1}
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {pipelineMsg && (
            <div
              className={`text-sm rounded-lg px-3 py-2 mb-3 ${
                pipelineMsg.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : pipelineMsg.type === "error"
                  ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
              }`}
            >
              {pipelineMsg.text}
              {pipelineMsg.type === "success" && (
                <a
                  href={`/projects/${projectId}/discovery/brief`}
                  className="block mt-1 font-medium text-[#ff6c37] hover:underline"
                >
                  View Brief &rarr;
                </a>
              )}
            </div>
          )}

          <button
            onClick={handleRunPipeline}
            disabled={isPending || evidenceStats.chunkCount === 0}
            className={`w-full text-sm font-medium py-3 px-4 rounded-lg transition-colors duration-150 disabled:opacity-50 ${
              evidenceStats.chunkCount === 0
                ? "bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-[#ff6c37] hover:bg-[#e5552a] text-white"
            }`}
          >
            {isPending
              ? "Pipeline running..."
              : evidenceStats.chunkCount === 0
              ? "Ingest evidence first"
              : `Run Discovery Pipeline (${evidenceStats.chunkCount} chunks)`}
          </button>

          {evidenceStats.chunkCount === 0 && (
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              Paste Kepler data, DNS findings, or any intelligence on the left,
              then run the pipeline.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
