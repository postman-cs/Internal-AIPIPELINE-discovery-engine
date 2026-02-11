"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  triggerCascadeUpdate,
  acceptProposal,
  rejectProposal,
} from "@/lib/actions/cascade";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PhaseState {
  phase: string;
  label: string;
  shortLabel: string;
  description: string;
  implemented: boolean;
  order: number;
  dependencies: string[];
  latestVersion: number;
  status: string;
  snapshotId: string | null;
  lastComputedAt: string | null;
  hasArtifact: boolean;
}

interface SnapshotInfo {
  id: string;
  hash: string;
  stats: { total: number; bySource: Record<string, number> } | null;
  createdAt: string;
}

interface ProposalInfo {
  id: string;
  phase: string;
  snapshotId: string;
  baseVersion: number;
  status: string;
  diffSummary: string | null;
  proposedMarkdown: string | null;
  patchOps: number;
  createdAt: string;
  resolvedAt: string | null;
}

interface JobInfo {
  id: string;
  triggeredBy: string;
  snapshotId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
}

interface CascadeState {
  snapshots: SnapshotInfo[];
  phaseGraph: PhaseState[];
  proposals: ProposalInfo[];
  pendingCount: number;
  jobs: JobInfo[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  CLEAN: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  DIRTY: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24" },
  STALE: { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" },
  NEEDS_REVIEW: { bg: "rgba(59,130,246,0.1)", text: "#60a5fa" },
  CLEAN_WITH_EXCEPTIONS: { bg: "rgba(255,108,55,0.1)", text: "#fb923c" },
  PENDING: { bg: "rgba(59,130,246,0.1)", text: "#60a5fa" },
  ACCEPTED: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  REJECTED: { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
};

export function CascadeUpdatesPanel({
  projectId,
  cascadeState,
}: {
  projectId: string;
  cascadeState: CascadeState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);

  const handleTriggerUpdate = () => {
    startTransition(async () => {
      setMessage({ type: "info", text: "Running cascade update... This may take 30-60 seconds." });
      const result = await triggerCascadeUpdate(projectId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        const errorNote = result.errors?.length ? ` (${result.errors.length} errors)` : "";
        setMessage({ type: "success", text: `Cascade complete: ${result.impactedPhases?.length ?? 0} phases impacted, ${result.proposalCount ?? 0} proposals created.${errorNote}` });
        router.refresh();
      }
    });
  };

  const handleAccept = (proposalId: string) => {
    startTransition(async () => {
      const result = await acceptProposal(proposalId);
      if (result.error) setMessage({ type: "error", text: result.error });
      else {
        setMessage({ type: "success", text: `Accepted! New v${result.newVersion} created.` });
        router.refresh();
      }
    });
  };

  const handleReject = (proposalId: string) => {
    startTransition(async () => {
      const result = await rejectProposal(proposalId);
      if (result.error) setMessage({ type: "error", text: result.error });
      else {
        setMessage({ type: "success", text: "Proposal rejected." });
        router.refresh();
      }
    });
  };

  const pendingProposals = cascadeState.proposals.filter((p) => p.status === "PENDING");
  const resolvedProposals = cascadeState.proposals.filter((p) => p.status !== "PENDING");

  return (
    <div className="space-y-6">
      {message && (
        <div
          className="text-sm rounded-xl px-4 py-3"
          style={{
            background: message.type === "success" ? "rgba(16,185,129,0.08)" : message.type === "error" ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)",
            border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.15)" : message.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)"}`,
            color: message.type === "success" ? "#34d399" : message.type === "error" ? "#f87171" : "#60a5fa",
          }}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={handleTriggerUpdate} disabled={isPending} className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50">
          {isPending ? "Running Cascade..." : "Run Cascade Update"}
        </button>
        {cascadeState.pendingCount > 0 && (
          <span className="badge-info">{cascadeState.pendingCount} pending proposal{cascadeState.pendingCount > 1 ? "s" : ""}</span>
        )}
      </div>

      {cascadeState.snapshots.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Latest Evidence Snapshot</h2>
          <SnapshotCard snapshot={cascadeState.snapshots[0]} />
        </div>
      )}

      <div className="card">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Phase Graph</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {cascadeState.phaseGraph.map((node) => <PhaseCard key={node.phase} node={node} />)}
        </div>
      </div>

      {pendingProposals.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Pending Proposals</h2>
          <div className="space-y-3">
            {pendingProposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                isExpanded={expandedProposal === p.id}
                onToggle={() => setExpandedProposal(expandedProposal === p.id ? null : p.id)}
                onAccept={() => handleAccept(p.id)}
                onReject={() => handleReject(p.id)}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {resolvedProposals.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Resolved Proposals</h2>
          <div className="space-y-2">
            {resolvedProposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="text-sm" style={{ color: "var(--foreground)" }}>{p.phase} (v{p.baseVersion})</span>
                  <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{p.patchOps} changes</span>
                </div>
                <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{p.resolvedAt ? new Date(p.resolvedAt).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cascadeState.jobs.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Recent Recompute Jobs</h2>
          <div className="space-y-2">
            {cascadeState.jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between py-2 px-3 rounded-lg text-sm" style={{ background: "var(--background-secondary)" }}>
                <div className="flex items-center gap-3">
                  <StatusBadge status={j.status} />
                  <span style={{ color: "var(--foreground)" }}>{j.triggeredBy}</span>
                  <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                    {j.completedTasks}/{j.taskCount} tasks
                    {j.failedTasks > 0 && <span style={{ color: "var(--accent-red)" }}> ({j.failedTasks} failed)</span>}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{new Date(j.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cascadeState.snapshots.length === 0 && cascadeState.proposals.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-sm mb-2" style={{ color: "var(--foreground-muted)" }}>No cascade updates yet.</p>
          <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>Ingest evidence, then run a Cascade Update to generate proposals.</p>
        </div>
      )}
    </div>
  );
}

function SnapshotCard({ snapshot }: { snapshot: SnapshotInfo }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
      <div><span style={{ color: "var(--foreground-dim)" }}>ID: </span><span className="font-mono" style={{ color: "var(--foreground)" }}>{snapshot.id.slice(0, 12)}...</span></div>
      <div><span style={{ color: "var(--foreground-dim)" }}>Hash: </span><span className="font-mono" style={{ color: "var(--foreground)" }}>{snapshot.hash.slice(0, 16)}...</span></div>
      <div><span style={{ color: "var(--foreground-dim)" }}>Chunks: </span><span className="font-semibold" style={{ color: "var(--foreground)" }}>{snapshot.stats?.total ?? 0}</span></div>
      {snapshot.stats?.bySource && (
        <div className="flex gap-2">
          {Object.entries(snapshot.stats.bySource).map(([src, count]) => (
            <span key={src} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" }}>{src}: {count}</span>
          ))}
        </div>
      )}
      <div><span style={{ color: "var(--foreground-dim)" }}>Created: </span><span style={{ color: "var(--foreground)" }}>{new Date(snapshot.createdAt).toLocaleString()}</span></div>
    </div>
  );
}

function PhaseCard({ node }: { node: PhaseState }) {
  return (
    <div
      className="rounded-lg p-3 text-center transition-all duration-200"
      style={{
        border: node.implemented ? "1px solid var(--border-bright)" : "1px dashed var(--border)",
        background: node.implemented ? "var(--surface)" : "transparent",
        opacity: node.implemented ? 1 : 0.5,
      }}
    >
      <div className="text-xs font-bold mb-1" style={{ color: "var(--foreground-dim)" }}>{node.shortLabel}</div>
      <div className="text-[11px] font-medium mb-2 leading-tight" style={{ color: "var(--foreground)" }}>{node.label}</div>
      <StatusBadge status={node.status} />
      {node.hasArtifact && <div className="text-[10px] mt-1" style={{ color: "var(--foreground-dim)" }}>v{node.latestVersion}</div>}
      {!node.implemented && <div className="text-[10px] mt-1 italic" style={{ color: "var(--foreground-dim)" }}>not built</div>}
    </div>
  );
}

function ProposalCard({
  proposal, isExpanded, onToggle, onAccept, onReject, isPending,
}: {
  proposal: ProposalInfo; isExpanded: boolean; onToggle: () => void; onAccept: () => void; onReject: () => void; isPending: boolean;
}) {
  const isStale = proposal.patchOps === 0 && proposal.phase !== "DISCOVERY";

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-bright)" }}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150"
        onClick={onToggle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{proposal.phase.replace(/_/g, " ")}</span>
          {isStale && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" }}>placeholder</span>}
          <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>patching v{proposal.baseVersion} &bull; {proposal.patchOps} changes</span>
        </div>
        <div className="flex items-center gap-2">
          {!isStale && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onAccept(); }} disabled={isPending} className="text-xs font-medium px-3 py-1.5 rounded-md text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>Accept</button>
              <button onClick={(e) => { e.stopPropagation(); onReject(); }} disabled={isPending} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">Reject</button>
            </>
          )}
          <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 py-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          {proposal.diffSummary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>Change Summary</h4>
              <div className="rounded-lg p-3 text-sm" style={{ background: "var(--background-secondary)" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal.diffSummary}</ReactMarkdown>
              </div>
            </div>
          )}
          {proposal.proposedMarkdown && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>Proposed Output Preview</h4>
              <div className="rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm max-w-none" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal.proposedMarkdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.bg}` }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
