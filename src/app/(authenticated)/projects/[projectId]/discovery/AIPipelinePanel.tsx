"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  ingestDiscoveryDocument,
  runAIDiscoveryPipeline,
} from "@/lib/actions/discovery";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { DragDropZone } from "@/components/DragDropZone";

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
  { value: "IMAGE", label: "Image / Screenshot" },
];

const PIPELINE_STEPS = [
  { key: "recon", label: "Recon Synthesis" },
  { key: "signals", label: "Signal Classification" },
  { key: "maturity", label: "Maturity Scoring" },
  { key: "hypothesis", label: "Hypothesis Generation" },
  { key: "brief", label: "Brief Generation" },
];

export function AIPipelinePanel({ projectId, evidenceStats, hasArtifact, latestVersion }: AIPipelinePanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ingestSource, setIngestSource] = useState("KEPLER");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestMsg, setIngestMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pipelineMsg, setPipelineMsg] = useState<{ type: "success" | "error" | "running"; text: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Clean up Object URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on unmount
  }, []);

  // --- Ingest text ---
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
        toast.error("Ingest failed", result.error);
      } else {
        const cascadeNote = result.impactedPhases?.length
          ? ` ${result.impactedPhases.length} phases impacted.`
          : "";
        const msg = `${result.chunkCount} chunks created.${cascadeNote}`;
        setIngestMsg({ type: "success", text: msg });
        toast.success("Evidence ingested", msg);
        setIngestTitle("");
        setIngestContent("");
        setImagePreview(null);
        router.refresh();
      }
    });
  };

  // --- File upload (processes one file at a time) ---
  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length > 1) {
      toast.warning("One file at a time", "Please drop or select a single file. Only the first file will be loaded.");
    }
    const file = files[0];

    if (file.type.startsWith("image/")) {
      // Convert to text description + base64 reference
      const text = await readFileAsText(file);
      if (text) {
        setIngestSource("IMAGE");
        setIngestTitle(file.name);
        setIngestContent(text);
        // Revoke previous preview URL to prevent memory leak
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(URL.createObjectURL(file));
        toast.info("Image loaded", `${file.name} ready to ingest`);
      }
    } else {
      // Text file
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setIngestSource("MANUAL");
        setIngestTitle(file.name);
        setIngestContent(content);
        toast.info("File loaded", `${file.name} ready to ingest`);
      };
      reader.readAsText(file);
    }
  };

  // --- Handle dropped text ---
  const handleTextDrop = (text: string) => {
    setIngestContent((prev) => prev + (prev ? "\n\n" : "") + text);
    toast.info("Text pasted", "Content added to ingest area");
  };

  // --- Pipeline ---
  const handleRunPipeline = () => {
    startTransition(async () => {
      setPipelineMsg({ type: "running", text: "Running 5-agent pipeline... This may take 30-60 seconds." });
      toast.info("Pipeline started", "Running 5 AI agents...");
      const result = await runAIDiscoveryPipeline(projectId);
      if (result.error) {
        setPipelineMsg({ type: "error", text: result.error });
        toast.error("Pipeline failed", result.error);
      } else {
        setPipelineMsg({
          type: "success",
          text: `Discovery Brief v${result.version} generated! ${result.agentRuns} agent runs, ${result.citationCount} citations.`,
        });
        toast.success(
          `Brief v${result.version} generated`,
          `${result.agentRuns} agents, ${result.citationCount} citations`
        );
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Evidence Stats */}
      <div className="flex gap-3 flex-wrap">
        <StatPill value={evidenceStats.docCount} label="Source Docs" color="var(--accent-orange)" />
        <StatPill value={evidenceStats.chunkCount} label="Evidence Chunks" color="var(--accent-blue)" />
        {hasArtifact && <StatPill value={`v${latestVersion}`} label="Latest Brief" color="var(--accent-green)" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingest Evidence Panel */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            1. Ingest Evidence
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--foreground-dim)" }}>
            Paste text, drop files, or upload images — everything gets chunked, embedded, and stored as citable evidence.
          </p>

          {ingestMsg && (
            <div
              className="text-sm rounded-lg px-3 py-2 mb-3"
              style={{
                background: ingestMsg.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${ingestMsg.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                color: ingestMsg.type === "success" ? "#34d399" : "#f87171",
              }}
            >
              {ingestMsg.text}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Source Type</label>
                <select value={ingestSource} onChange={(e) => setIngestSource(e.target.value)} className="input-field text-sm">
                  {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

            {/* Content area */}
            <div>
              <label className="label">Content</label>
              <textarea
                value={ingestContent}
                onChange={(e) => setIngestContent(e.target.value)}
                className="input-field text-sm resize-y font-mono"
                style={{ minHeight: "120px" }}
                placeholder="Paste raw intelligence: Kepler data, DNS findings, call transcripts, etc."
              />
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="max-h-32 w-full object-contain" style={{ background: "var(--background-secondary)" }} />
                <button
                  onClick={() => { if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); setIngestContent(""); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: "rgba(0,0,0,0.7)", color: "var(--foreground-muted)" }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Drag & Drop + File Upload */}
            <DragDropZone
              onFileDrop={handleFileUpload}
              onTextDrop={handleTextDrop}
              accept="image/*,.txt,.md,.csv,.json,.pdf"
              maxSizeMB={10}
              className="py-4"
            >
              <div className="flex flex-col items-center py-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <p className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Drop files or text here, or click to upload
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                  Images, text, PDFs — up to 10MB
                </p>
              </div>
            </DragDropZone>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.md,.csv,.json,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleFileUpload(files);
                e.target.value = "";
              }}
            />

            <button onClick={handleIngest} disabled={isPending || !ingestContent.trim()} className="btn-primary w-full disabled:opacity-50 text-sm">
              {isPending ? "Ingesting..." : "Ingest & Embed"}
            </button>
          </div>
        </div>

        {/* AI Pipeline Panel */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>2. Run AI Pipeline</h2>
          <p className="text-xs mb-4" style={{ color: "var(--foreground-dim)" }}>
            Run the 5-agent discovery pipeline to generate an evidence-cited Discovery Brief.
          </p>

          <div className="space-y-2 mb-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-3 text-xs">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${pipelineMsg?.type === "running" ? "animate-pulse" : ""}`}
                  style={{
                    background: pipelineMsg?.type === "success" ? "rgba(16,185,129,0.12)" : pipelineMsg?.type === "running" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                    color: pipelineMsg?.type === "success" ? "#34d399" : pipelineMsg?.type === "running" ? "#fbbf24" : "var(--foreground-dim)",
                    border: `1px solid ${pipelineMsg?.type === "success" ? "rgba(16,185,129,0.15)" : pipelineMsg?.type === "running" ? "rgba(245,158,11,0.15)" : "var(--border)"}`,
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ color: "var(--foreground-muted)" }} className="font-medium">{step.label}</span>
              </div>
            ))}
          </div>

          {pipelineMsg && (
            <div
              className="text-sm rounded-lg px-3 py-2 mb-3"
              style={{
                background: pipelineMsg.type === "success" ? "rgba(16,185,129,0.08)" : pipelineMsg.type === "error" ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)",
                border: `1px solid ${pipelineMsg.type === "success" ? "rgba(16,185,129,0.15)" : pipelineMsg.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)"}`,
                color: pipelineMsg.type === "success" ? "#34d399" : pipelineMsg.type === "error" ? "#f87171" : "#60a5fa",
              }}
            >
              {pipelineMsg.text}
              {pipelineMsg.type === "success" && (
                <a href={`/projects/${projectId}/discovery/brief`} className="block mt-1 font-medium" style={{ color: "var(--accent-orange)" }}>
                  View Brief →
                </a>
              )}
            </div>
          )}

          <button
            onClick={handleRunPipeline}
            disabled={isPending || evidenceStats.chunkCount === 0}
            className={`w-full text-sm font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 ${evidenceStats.chunkCount === 0 ? "cursor-not-allowed" : ""}`}
            style={{
              background: evidenceStats.chunkCount === 0 ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #ff6c37, #e5552a)",
              color: evidenceStats.chunkCount === 0 ? "var(--foreground-dim)" : "white",
              boxShadow: evidenceStats.chunkCount > 0 ? "var(--glow-orange)" : "none",
            }}
          >
            {isPending ? "Pipeline running..." : evidenceStats.chunkCount === 0 ? "Ingest evidence first" : `Run Discovery Pipeline (${evidenceStats.chunkCount} chunks)`}
          </button>

          {evidenceStats.chunkCount === 0 && (
            <p className="text-[11px] mt-2 text-center" style={{ color: "var(--foreground-dim)" }}>
              Paste Kepler data, DNS findings, or any intelligence on the left, then run the pipeline.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs leading-tight" style={{ color: "var(--foreground-dim)" }}>
        {label.split(" ").map((w, i, arr) => <span key={i}>{w}{i < arr.length - 1 && <br />}</span>)}
      </span>
    </div>
  );
}

/** Read a file and return its content as text (for images, returns a description + base64 reference) */
async function readFileAsText(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Store as a text description with base64 metadata
        resolve(
          `[Image: ${file.name}]\n` +
          `Type: ${file.type}\n` +
          `Size: ${(file.size / 1024).toFixed(1)}KB\n` +
          `Uploaded: ${new Date().toISOString()}\n\n` +
          `[Base64 data stored for reference]\n` +
          base64.slice(0, 500) + "..."
        );
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    }
  });
}
