"use client";

import { useState } from "react";
import { scaffoldProjectRepo } from "@/lib/actions/scaffold-repo";

interface Props {
  projectId: string;
  hasArtifact: boolean;
  existingRepoUrl?: string;
}

export function ScaffoldRepoButton({ projectId, hasArtifact, existingRepoUrl }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; repoUrl?: string; error?: string; filesCreated?: number; postmanWorkspaceUrl?: string; postmanErrors?: string[] } | null>(null);

  const handleScaffold = async () => {
    setIsPending(true);
    setResult(null);
    try {
      const res = await scaffoldProjectRepo(projectId, customPrompt.trim() || undefined);
      setResult(res);
      setShowPrompt(false);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsPending(false);
    }
  };

  const repoUrl = result?.repoUrl ?? existingRepoUrl;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(6,214,214,0.06))",
        border: "1px solid rgba(139,92,246,0.2)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(139,92,246,0.12)" }}
          >
            <svg className="w-5 h-5" style={{ color: "#a78bfa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {repoUrl ? "Repo Scaffolded" : "Scaffold Delivery Repo"}
            </p>
            <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              {repoUrl
                ? "One Service = One Workspace = One Repo"
                : "Create a GitHub repo with specs, collections, CI/CD, environments, and governance"
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#a78bfa", background: "rgba(139,92,246,0.1)" }}
            >
              View Repo
            </a>
          )}
          <button
            onClick={handleScaffold}
            disabled={isPending || !hasArtifact}
            className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scaffolding...
              </>
            ) : repoUrl ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Re-scaffold
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Repo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom instructions toggle + textarea */}
      {!showPrompt && !repoUrl && (
        <button
          onClick={() => setShowPrompt(true)}
          className="mt-3 text-xs font-medium"
          style={{ color: "var(--foreground-dim)" }}
        >
          + Add custom instructions
        </button>
      )}
      {showPrompt && (
        <div className="mt-3">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Optional: Add specific instructions for the repo scaffold (e.g., 'Use Kong as the API gateway', 'Include gRPC proto files', 'Add Terraform modules for AWS ECS'...)"
            className="input-field text-xs resize-y font-mono w-full"
            style={{ minHeight: "80px" }}
          />
        </div>
      )}

      {result?.error && (
        <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
          {result.error}
        </div>
      )}

      {result?.success && (
        <div className="mt-3 text-xs rounded-lg px-3 py-2 space-y-1" style={{ background: "rgba(16,185,129,0.08)", color: "#34d399", border: "1px solid rgba(16,185,129,0.15)" }}>
          <p>Repo created with {result.filesCreated} files: OpenAPI spec (YAML), collections, environments, CI/CD, governance.</p>
          {result.postmanWorkspaceUrl && (
            <p>
              Postman workspace provisioned:{" "}
              <a href={result.postmanWorkspaceUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                Open in Postman
              </a>
            </p>
          )}
          {result.postmanErrors && result.postmanErrors.length > 0 && (
            <p style={{ color: "#fbbf24" }}>Postman warnings: {result.postmanErrors.join("; ")}</p>
          )}
        </div>
      )}

      {!hasArtifact && (
        <div className="mt-3 text-xs" style={{ color: "var(--foreground-dim)" }}>
          Run the cascade first to generate deployment artifacts.
        </div>
      )}
    </div>
  );
}
