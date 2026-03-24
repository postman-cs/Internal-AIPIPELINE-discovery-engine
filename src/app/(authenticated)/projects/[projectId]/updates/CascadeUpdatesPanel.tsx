"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  triggerCascadeUpdate,
  acceptProposal,
  rejectProposal,
} from "@/lib/actions/cascade";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LazyCanvas } from "@/components/LazyCanvas";

const OrbitalProgression = dynamic(() => import("./OrbitalProgression"), { ssr: false });

const PHASE_ROUTES: Record<string, string> = {
  DISCOVERY: "/discovery",
  CURRENT_TOPOLOGY: "/topology",
  DESIRED_FUTURE_STATE: "/topology",
  SOLUTION_DESIGN: "",
  INFRASTRUCTURE: "/cicd",
  TEST_DESIGN: "",
  CRAFT_SOLUTION: "",
  TEST_SOLUTION: "",
  DEPLOYMENT_PLAN: "/execution",
  BUILD_LOG: "/buildlog",
};

const EXECUTION_PHASES = new Set(["DEPLOYMENT_PLAN", "BUILD_LOG"]);

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
  hasServiceTemplate?: boolean;
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

interface CascadeProgress {
  completedTasks: number;
  totalTasks: number;
  failedTasks: number;
  currentPhase: string | null;
  errors: string[];
  status: string;
}

function useCascadeProgress(projectId: string, jobId: string | null) {
  const [progress, setProgress] = useState<CascadeProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [agentOutput, setAgentOutput] = useState("");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setProgress(null);
      setIsRunning(false);
      setAgentOutput("");
      return;
    }

    setIsRunning(true);
    setAgentOutput("");
    const es = new EventSource(`/api/projects/${projectId}/cascade/status?jobId=${jobId}`);
    sourceRef.current = es;

    es.addEventListener("progress", (e: MessageEvent) => {
      setProgress(JSON.parse(e.data));
    });

    es.addEventListener("agent_token", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const text = Array.isArray(data.tokens) ? data.tokens.join("") : "";
      setAgentOutput((prev) => prev + text);
    });

    es.addEventListener("complete", (e: MessageEvent) => {
      setProgress(JSON.parse(e.data));
      setIsRunning(false);
      es.close();
    });

    es.addEventListener("error", () => {
      setIsRunning(false);
      es.close();
    });

    es.addEventListener("timeout", () => {
      setIsRunning(false);
      es.close();
    });

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [projectId, jobId]);

  return { progress, isRunning, currentPhase: progress?.currentPhase ?? null, agentOutput };
}

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
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [optimisticActions, setOptimisticActions] = useState<Record<string, "accepting" | "rejecting">>({});

  const { progress: cascadeProgress, isRunning: cascadeRunning, agentOutput } = useCascadeProgress(projectId, activeJobId);

  useEffect(() => {
    if (!activeJobId || cascadeRunning || !cascadeProgress) return;
    const failed = cascadeProgress.failedTasks;
    const errorNote = failed > 0 ? ` (${failed} errors)` : "";
    setMessage({
      type: failed > 0 ? "error" : "success",
      text: `Cascade complete: ${cascadeProgress.completedTasks}/${cascadeProgress.totalTasks} phases processed.${errorNote}`,
    });
    setActiveJobId(null);
    router.refresh();
  }, [activeJobId, cascadeRunning, cascadeProgress, router]);

  const preflightWarnings: string[] = [];
  if (cascadeState.snapshots.length === 0) {
    preflightWarnings.push("No evidence snapshots yet — results may be limited.");
  }
  const latestChunkCount = cascadeState.snapshots[0]?.stats?.total ?? 0;
  if (latestChunkCount > 0 && latestChunkCount < 5) {
    preflightWarnings.push("Very few evidence chunks ingested. Consider adding more data sources.");
  }
  if (!cascadeState.hasServiceTemplate && cascadeState.snapshots.length > 0) {
    preflightWarnings.push("No service template loaded. Topology phases may produce incomplete results.");
  }

  const handleTriggerUpdate = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        // Call API route directly — runs inline with maxDuration=800s
        // Server action fire-and-forgets which gets killed on Vercel serverless
        const res = await fetch(`/api/projects/${projectId}/cascade/recompute`, {
          method: "POST",
        });
        const result = await res.json();
        if (result.error) {
          setMessage({ type: "error", text: result.error });
          return;
        }
        const errMsg = result.errors?.length ? `\nErrors: ${result.errors.join("; ")}` : "";
        const skipMsg = result.skipped?.length ? `\nSkipped: ${result.skipped.join(", ")}` : "";
        setMessage({
          type: result.errors?.length ? "error" : "success",
          text: `Cascade complete: ${result.completedTasks}/${result.impactedPhases?.length ?? 0} phases processed.${errMsg}${skipMsg}`,
        });
        router.refresh();
      } catch (err) {
        setMessage({ type: "error", text: `Cascade failed: ${err instanceof Error ? err.message : String(err)}` });
      }
    });
  };

  const handleAccept = (proposalId: string) => {
    setOptimisticActions(prev => ({ ...prev, [proposalId]: "accepting" }));
    startTransition(async () => {
      const result = await acceptProposal(proposalId);
      if (result.error) {
        setOptimisticActions(prev => {
          const next = { ...prev };
          delete next[proposalId];
          return next;
        });
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `Accepted! New v${result.newVersion} created.` });
        router.refresh();
      }
    });
  };

  const handleReject = (proposalId: string) => {
    setOptimisticActions(prev => ({ ...prev, [proposalId]: "rejecting" }));
    startTransition(async () => {
      const result = await rejectProposal(proposalId);
      if (result.error) {
        setOptimisticActions(prev => {
          const next = { ...prev };
          delete next[proposalId];
          return next;
        });
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Proposal rejected." });
        router.refresh();
      }
    });
  };

  const handlePhaseSelect = useCallback((phase: string | null) => {
    if (!phase) return;
    const route = PHASE_ROUTES[phase] ?? "";
    router.push(`/projects/${projectId}${route}`);
  }, [projectId, router]);

  const pendingProposals = cascadeState.proposals.filter(
    (p) => p.status === "PENDING" && !optimisticActions[p.id]
  );
  const optimisticProposals = cascadeState.proposals.filter(
    (p) => p.status === "PENDING" && optimisticActions[p.id]
  );
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

      {preflightWarnings.length > 0 && (
        <div className="space-y-1.5">
          {preflightWarnings.map((w, i) => (
            <div
              key={i}
              className="text-xs rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", color: "#fbbf24" }}
            >
              <span>⚠</span> {w}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={handleTriggerUpdate} disabled={isPending || cascadeRunning} className="btn-primary text-sm py-2.5 px-5 disabled:opacity-50">
          {cascadeRunning ? "Cascade Running..." : isPending ? "Starting Cascade..." : "Run Cascade Update"}
        </button>
        {cascadeState.pendingCount > 0 && (
          <span className="badge-info">{cascadeState.pendingCount} pending proposal{cascadeState.pendingCount > 1 ? "s" : ""}</span>
        )}
      </div>

      {cascadeRunning && cascadeProgress && (
        <div className="rounded-xl px-4 py-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "#60a5fa" }}>
              {cascadeProgress.currentPhase
                ? `Running ${cascadeProgress.currentPhase.replace(/_/g, " ")}...`
                : "Initializing..."}
            </span>
            <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              {cascadeProgress.completedTasks}/{cascadeProgress.totalTasks} complete
              {cascadeProgress.failedTasks > 0 && (
                <span style={{ color: "#f87171" }}> · {cascadeProgress.failedTasks} failed</span>
              )}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${cascadeProgress.totalTasks > 0 ? (cascadeProgress.completedTasks / cascadeProgress.totalTasks) * 100 : 0}%`,
                background: cascadeProgress.failedTasks > 0
                  ? "linear-gradient(90deg, #60a5fa, #f59e0b)"
                  : "linear-gradient(90deg, #60a5fa, #34d399)",
              }}
            />
          </div>
          {agentOutput && (
            <details open className="mt-3 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(59,130,246,0.08)" }}>
              <summary
                className="cursor-pointer px-4 py-2 text-xs font-medium select-none"
                style={{ color: "#60a5fa", background: "rgba(59,130,246,0.04)" }}
              >
                Live Agent Output
              </summary>
              <div
                className="px-4 py-3 prose prose-sm prose-invert max-w-none max-h-64 overflow-y-auto text-xs"
                style={{ background: "var(--background-secondary)" }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{agentOutput}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>
      )}

      {cascadeState.snapshots.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Latest Evidence Snapshot</h2>
          <SnapshotCard snapshot={cascadeState.snapshots[0]} />
        </div>
      )}

      {/* Orbital Progression Visualization */}
      <LazyCanvas>
        <OrbitalProgression
          phaseGraph={cascadeState.phaseGraph}
          proposals={cascadeState.proposals}
          jobs={cascadeState.jobs}
          onPhaseSelect={handlePhaseSelect}
        />
      </LazyCanvas>

      {/* Phase Graph (compact reference) */}
      <div className="card">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Phase Graph</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {cascadeState.phaseGraph
            .filter((node) => !EXECUTION_PHASES.has(node.phase))
            .map((node) => <PhaseCard key={node.phase} node={node} projectId={projectId} />)}
        </div>
      </div>

      {(pendingProposals.length > 0 || optimisticProposals.length > 0) && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Pending Proposals</h2>
          <div className="space-y-3">
            {optimisticProposals.map((p) => {
              const action = optimisticActions[p.id];
              const route = PHASE_ROUTES[p.phase] ?? "";
              const artifactHref = route ? `/projects/${projectId}${route}` : null;
              return (
                <div
                  key={p.id}
                  className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{
                    border: `1px solid ${action === "accepting" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    background: action === "accepting" ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-block w-3 h-3 rounded-full animate-pulse" style={{ background: action === "accepting" ? "#34d399" : "#f87171" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{p.phase.replace(/_/g, " ")}</span>
                    <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                      {action === "accepting" ? "Accepting..." : "Rejecting..."}
                    </span>
                  </div>
                  {action === "accepting" && artifactHref && (
                    <Link href={artifactHref} className="text-xs font-medium transition-colors hover:underline" style={{ color: "#34d399" }}>
                      View artifact →
                    </Link>
                  )}
                </div>
              );
            })}
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
            {resolvedProposals.map((p) => {
              const route = PHASE_ROUTES[p.phase] ?? "";
              const artifactHref = route ? `/projects/${projectId}${route}` : null;
              return (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={p.status} />
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>{p.phase} (v{p.baseVersion})</span>
                    <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{p.patchOps} changes</span>
                    {p.status === "ACCEPTED" && artifactHref && (
                      <Link href={artifactHref} className="text-xs font-medium transition-colors hover:underline" style={{ color: "#34d399" }}>
                        View artifact →
                      </Link>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{p.resolvedAt ? new Date(p.resolvedAt).toLocaleDateString() : ""}</span>
                </div>
              );
            })}
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

function PhaseCard({ node, projectId }: { node: PhaseState; projectId: string }) {
  const route = PHASE_ROUTES[node.phase] ?? "";
  const href = `/projects/${projectId}${route}`;

  return (
    <Link
      href={href}
      className="rounded-lg p-3 text-center transition-all duration-200 hover:ring-1 hover:ring-[var(--accent-cyan)] cursor-pointer block"
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
    </Link>
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
