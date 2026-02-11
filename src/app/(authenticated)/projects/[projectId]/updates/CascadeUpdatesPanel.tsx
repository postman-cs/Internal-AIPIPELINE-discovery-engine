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

// ---------------------------------------------------------------------------
// Types matching getCascadeState return
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  CLEAN: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  DIRTY: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  STALE: "bg-gray-100 dark:bg-gray-800 text-gray-500",
  NEEDS_REVIEW: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  CLEAN_WITH_EXCEPTIONS: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  PENDING: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  ACCEPTED: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  REJECTED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CascadeUpdatesPanel({
  projectId,
  cascadeState,
}: {
  projectId: string;
  cascadeState: CascadeState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);

  const handleTriggerUpdate = () => {
    startTransition(async () => {
      setMessage({
        type: "info",
        text: "Running cascade update... This may take 30-60 seconds.",
      });

      const result = await triggerCascadeUpdate(projectId);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        const errorNote =
          result.errors && result.errors.length > 0
            ? ` (${result.errors.length} errors: ${result.errors.join("; ")})`
            : "";
        setMessage({
          type: "success",
          text: `Cascade complete: ${result.impactedPhases?.length ?? 0} phases impacted, ${result.proposalCount ?? 0} proposals created.${errorNote}`,
        });
        router.refresh();
      }
    });
  };

  const handleAccept = (proposalId: string) => {
    startTransition(async () => {
      const result = await acceptProposal(proposalId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: `Accepted! New version v${result.newVersion} created. ${result.downstreamDirty?.length ?? 0} downstream phases marked dirty.`,
        });
        router.refresh();
      }
    });
  };

  const handleReject = (proposalId: string) => {
    startTransition(async () => {
      const result = await rejectProposal(proposalId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Proposal rejected. Snapshot ignored for this phase." });
        router.refresh();
      }
    });
  };

  const pendingProposals = cascadeState.proposals.filter(
    (p) => p.status === "PENDING"
  );
  const resolvedProposals = cascadeState.proposals.filter(
    (p) => p.status !== "PENDING"
  );

  return (
    <div className="space-y-6">
      {/* Message banner */}
      {message && (
        <div
          className={`text-sm rounded-lg px-4 py-3 ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
              : message.type === "error"
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleTriggerUpdate}
          disabled={isPending}
          className="bg-[#ff6c37] hover:bg-[#e5552a] text-white text-sm font-medium py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? "Running Cascade..." : "Run Cascade Update"}
        </button>
        {cascadeState.pendingCount > 0 && (
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2.5 py-1 rounded-full">
            {cascadeState.pendingCount} pending proposal
            {cascadeState.pendingCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Latest Snapshot */}
      {cascadeState.snapshots.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Latest Evidence Snapshot
          </h2>
          <SnapshotCard snapshot={cascadeState.snapshots[0]} />
        </div>
      )}

      {/* Phase Graph */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Phase Graph
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {cascadeState.phaseGraph.map((node) => (
            <PhaseCard key={node.phase} node={node} />
          ))}
        </div>
      </div>

      {/* Pending Proposals */}
      {pendingProposals.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Pending Proposals
          </h2>
          <div className="space-y-3">
            {pendingProposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                isExpanded={expandedProposal === p.id}
                onToggle={() =>
                  setExpandedProposal(
                    expandedProposal === p.id ? null : p.id
                  )
                }
                onAccept={() => handleAccept(p.id)}
                onReject={() => handleReject(p.id)}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved Proposals */}
      {resolvedProposals.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Resolved Proposals
          </h2>
          <div className="space-y-2">
            {resolvedProposals.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-900/30"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {p.phase} (v{p.baseVersion})
                  </span>
                  <span className="text-xs text-gray-400">
                    {p.patchOps} changes
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {p.resolvedAt
                    ? new Date(p.resolvedAt).toLocaleDateString()
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {cascadeState.jobs.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Recent Recompute Jobs
          </h2>
          <div className="space-y-2">
            {cascadeState.jobs.map((j) => (
              <div
                key={j.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-900/30 text-sm"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={j.status} />
                  <span className="text-gray-700 dark:text-gray-300">
                    {j.triggeredBy}
                  </span>
                  <span className="text-xs text-gray-400">
                    {j.completedTasks}/{j.taskCount} tasks
                    {j.failedTasks > 0 && (
                      <span className="text-red-500">
                        {" "}
                        ({j.failedTasks} failed)
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(j.startedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {cascadeState.snapshots.length === 0 &&
        cascadeState.proposals.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-sm mb-2">
              No cascade updates yet.
            </p>
            <p className="text-xs text-gray-400">
              Ingest evidence on the Discovery page, then run a Cascade Update
              to generate proposals.
            </p>
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SnapshotCard({ snapshot }: { snapshot: SnapshotInfo }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
      <div>
        <span className="text-gray-500">ID: </span>
        <span className="font-mono text-gray-700 dark:text-gray-300">
          {snapshot.id.slice(0, 12)}...
        </span>
      </div>
      <div>
        <span className="text-gray-500">Hash: </span>
        <span className="font-mono text-gray-700 dark:text-gray-300">
          {snapshot.hash.slice(0, 16)}...
        </span>
      </div>
      <div>
        <span className="text-gray-500">Chunks: </span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {snapshot.stats?.total ?? 0}
        </span>
      </div>
      {snapshot.stats?.bySource && (
        <div className="flex gap-2">
          {Object.entries(snapshot.stats.bySource).map(([src, count]) => (
            <span
              key={src}
              className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] text-gray-600 dark:text-gray-400"
            >
              {src}: {count}
            </span>
          ))}
        </div>
      )}
      <div>
        <span className="text-gray-500">Created: </span>
        <span className="text-gray-700 dark:text-gray-300">
          {new Date(snapshot.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function PhaseCard({ node }: { node: PhaseState }) {
  return (
    <div
      className={`border rounded-lg p-3 text-center ${
        node.implemented
          ? "border-gray-200 dark:border-gray-700"
          : "border-dashed border-gray-300 dark:border-gray-700 opacity-60"
      }`}
    >
      <div className="text-xs font-bold text-gray-500 mb-1">
        {node.shortLabel}
      </div>
      <div className="text-[11px] font-medium text-gray-800 dark:text-gray-200 mb-2 leading-tight">
        {node.label}
      </div>
      <StatusBadge status={node.status} />
      {node.hasArtifact && (
        <div className="text-[10px] text-gray-400 mt-1">
          v{node.latestVersion}
        </div>
      )}
      {!node.implemented && (
        <div className="text-[10px] text-gray-400 mt-1 italic">
          not built
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  isExpanded,
  onToggle,
  onAccept,
  onReject,
  isPending,
}: {
  proposal: ProposalInfo;
  isExpanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  // Check if this is a stale placeholder
  const isStale = proposal.patchOps === 0 && proposal.phase !== "DISCOVERY";

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {proposal.phase.replace(/_/g, " ")}
          </span>
          {isStale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
              placeholder
            </span>
          )}
          <span className="text-xs text-gray-400">
            patching v{proposal.baseVersion} &bull; {proposal.patchOps} changes
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isStale && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept();
                }}
                disabled={isPending}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                disabled={isPending}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          <span className="text-xs text-gray-400">
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded: diff summary + markdown preview */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 space-y-4">
          {/* Diff summary */}
          {proposal.diffSummary && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Change Summary
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {proposal.diffSummary}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Proposed markdown preview */}
          {proposal.proposedMarkdown && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Proposed Output Preview
              </h4>
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {proposal.proposedMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
        STATUS_STYLES[status] ||
        "bg-gray-100 dark:bg-gray-800 text-gray-500"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
