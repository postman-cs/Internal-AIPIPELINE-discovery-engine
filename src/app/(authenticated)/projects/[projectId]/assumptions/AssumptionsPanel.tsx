"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  confirmAssumption,
  correctAssumptionAction,
  rejectAssumptionAction,
  bulkVerifyPhaseAction,
  resumeCascadeAfterVerification,
} from "@/lib/actions/assumptions";
import { useConfirm } from "@/components/shared";
import { useToast } from "@/components/Toast";
import { LazyCanvas } from "@/components/LazyCanvas";

const SignalObservatory = dynamic(() => import("./SignalObservatory"), { ssr: false });

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Assumption {
  id: string;
  phase: string;
  category: string;
  claim: string;
  reasoning: string | null;
  confidence: string;
  impact: string | null;
  status: string;
  humanResponse: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  evidenceIds: string[];
  blocksPhases: string[];
  createdAt: string;
}

interface Summary {
  totalAssumptions: number;
  pending: number;
  verified: number;
  corrected: number;
  rejected: number;
  autoVerified: number;
  criticalPending: Array<{ id: string; category: string; claim: string; impact: string | null; blocksPhases: string[] }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Panel
// ═══════════════════════════════════════════════════════════════════════════

export function AssumptionsPanel({
  projectId,
  initialData,
}: {
  projectId: string;
  initialData: { assumptions: Assumption[]; summary: Summary | null; error?: string };
}) {
  const [phaseFilter, setPhaseFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const [verifyTargetId, setVerifyTargetId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleObservatorySelect = useCallback((id: string | null) => {
    setSelectedStarId(id);
    if (id) {
      setExpandedId(id);
      setTimeout(() => {
        const el = cardRefs.current.get(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, []);

  useEffect(() => {
    if (selectedStarId) {
      const timer = setTimeout(() => setSelectedStarId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedStarId]);

  const assumptions = initialData.assumptions ?? [];
  const summary = initialData.summary;

  // Group by phase
  const phases = Array.from(new Set(assumptions.map((a) => a.phase)));
  const filtered = assumptions.filter((a) => {
    if (phaseFilter !== "ALL" && a.phase !== phaseFilter) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    return true;
  });

  const groupedByPhase = new Map<string, Assumption[]>();
  for (const a of filtered) {
    const list = groupedByPhase.get(a.phase) ?? [];
    list.push(a);
    groupedByPhase.set(a.phase, list);
  }

  function handleConfirm(id: string) {
    setVerifyTargetId(id);
    startTransition(async () => {
      const r = await confirmAssumption(id);
      if ("error" in r && r.error) toast.error("Confirmation failed", r.error);
      else toast.success("Confirmed", "Assumption verified as correct");
    });
  }

  const handleVerifyAnimComplete = useCallback(() => {
    setVerifyTargetId(null);
  }, []);

  function handleCorrect(id: string) {
    if (!correctionText.trim()) return;
    startTransition(async () => {
      const r = await correctAssumptionAction(id, correctionText);
      setCorrectionId(null);
      setCorrectionText("");
      if ("error" in r && r.error) toast.error("Correction failed", r.error);
      else toast.success("Corrected", "Downstream phases marked dirty for re-computation");
    });
  }

  async function handleReject(id: string) {
    const ok = await confirm({
      title: "Reject Assumption",
      message: "Rejecting will mark downstream phases as dirty. This cannot be undone. Continue?",
      confirmLabel: "Reject",
      variant: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await rejectAssumptionAction(id);
      if ("error" in r && r.error) toast.error("Rejection failed", r.error);
      else toast.success("Rejected", "Downstream phases marked dirty");
    });
  }

  function handleBulkVerify(phase: string) {
    startTransition(async () => {
      const r = await bulkVerifyPhaseAction(projectId, phase as never);
      if (r.success) toast.success("Bulk verified", `${r.verified} assumptions verified`);
      else toast.error("Bulk verify failed", r.error ?? "Unknown error");
    });
  }

  function handleVerifyAllPhases() {
    startTransition(async () => {
      let totalVerified = 0;
      for (const phase of phases) {
        const r = await bulkVerifyPhaseAction(projectId, phase as never);
        if (r.success) totalVerified += r.verified ?? 0;
      }
      if (totalVerified > 0) toast.success("Bulk verified", `${totalVerified} assumptions verified across all phases`);
      else toast.info("Nothing to verify", "No pending assumptions found");
    });
  }

  function handleResumeCascade() {
    startTransition(async () => {
      const r = await resumeCascadeAfterVerification(projectId);
      if (r.success) toast.success("Cascade resumed", `${r.completedTasks} tasks, ${r.proposalCount} proposals`);
      else toast.error("Resume failed", r.error ?? "Unknown error");
    });
  }

  const CONFIDENCE_COLORS: Record<string, string> = {
    High: "var(--accent-green)", Medium: "var(--accent-yellow)", Low: "var(--foreground-dim)",
  };
  const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
    PENDING: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)", text: "#fbbf24" },
    VERIFIED: { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)", text: "#34d399" },
    CORRECTED: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" },
    REJECTED: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)", text: "#f87171" },
    AUTO_VERIFIED: { bg: "rgba(139, 92, 246, 0.08)", border: "rgba(139, 92, 246, 0.2)", text: "#a78bfa" },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 page-animate">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Assumption Verification</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Review AI assumptions to keep the pipeline on the golden path
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary && summary.pending > 0 && (
            <button onClick={handleVerifyAllPhases} disabled={isPending} className="btn-secondary text-sm">
              {isPending ? "Verifying..." : `Verify All (${summary.pending})`}
            </button>
          )}
          {summary && summary.criticalPending.length === 0 && assumptions.length > 0 && (
            <button onClick={handleResumeCascade} disabled={isPending} className="btn-cyan text-sm">
              {isPending ? "Resuming..." : "Resume Cascade"}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog />

      {/* Signal Observatory */}
      {assumptions.length > 0 && (
        <div className="mb-6">
          <LazyCanvas>
            <SignalObservatory
              assumptions={assumptions}
              onSelect={handleObservatorySelect}
              selectedId={selectedStarId}
              verifyTargetId={verifyTargetId}
              onVerifyAnimComplete={handleVerifyAnimComplete}
            />
          </LazyCanvas>
        </div>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatPill label="Total" value={summary.totalAssumptions} color="var(--foreground)" />
          <StatPill label="Pending" value={summary.pending} color="#fbbf24" />
          <StatPill label="Verified" value={summary.verified} color="#34d399" />
          <StatPill label="Corrected" value={summary.corrected} color="#60a5fa" />
          <StatPill label="Rejected" value={summary.rejected} color="#f87171" />
        </div>
      )}

      {/* Critical warnings */}
      {summary && summary.criticalPending.length > 0 && (
        <div className="card mb-6" style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">!</span>
            <h3 className="font-semibold text-sm" style={{ color: "#f87171" }}>
              {summary.criticalPending.length} Critical Assumption{summary.criticalPending.length > 1 ? "s" : ""} Need Verification
            </h3>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
            The cascade is paused. Review and verify these before proceeding.
          </p>
          <ul className="space-y-1">
            {summary.criticalPending.map((cp) => (
              <li key={cp.id} className="text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#f87171" }} />
                <span style={{ color: "var(--foreground)" }}>{cp.claim}</span>
                <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>({cp.category})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          className="input-field w-auto text-sm"
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
        >
          <option value="ALL">All Phases</option>
          {phases.map((p) => <option key={p} value={p}>{formatPhase(p)}</option>)}
        </select>
        <select
          className="input-field w-auto text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="CORRECTED">Corrected</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
          {filtered.length} of {assumptions.length} shown
        </span>
      </div>

      {/* Empty state */}
      {assumptions.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-3xl mb-3" style={{ color: "var(--foreground-dim)" }}>&#9745;</div>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            No assumptions surfaced yet. Run the AI pipeline to generate assumptions.
          </p>
        </div>
      )}

      {/* Phase groups */}
      {Array.from(groupedByPhase.entries()).map(([phase, items]) => {
        const pendingCount = items.filter((a) => a.status === "PENDING").length;
        return (
          <div key={phase} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--accent-cyan)" }}>
                {formatPhase(phase)}
                <span className="ml-2 text-xs font-normal" style={{ color: "var(--foreground-dim)" }}>
                  ({items.length} assumption{items.length !== 1 ? "s" : ""})
                </span>
              </h2>
              {pendingCount > 0 && (
                <button
                  className="text-xs px-3 py-1 rounded-lg transition-all"
                  style={{ background: "rgba(6, 214, 214, 0.08)", color: "var(--accent-cyan)", border: "1px solid rgba(6, 214, 214, 0.15)" }}
                  onClick={() => handleBulkVerify(phase)}
                  disabled={isPending}
                >
                  Verify All ({pendingCount})
                </button>
              )}
            </div>

            <div className="space-y-2">
              {items.map((a) => {
                const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.PENDING;
                const isExpanded = expandedId === a.id;
                const isCorrecting = correctionId === a.id;

                return (
                  <div
                    key={a.id}
                    ref={(el) => { if (el) cardRefs.current.set(a.id, el); }}
                    className="rounded-xl transition-all duration-200"
                    style={{
                      background: selectedStarId === a.id ? `${style.text}10` : style.bg,
                      border: `1px solid ${selectedStarId === a.id ? style.text : style.border}`,
                      boxShadow: selectedStarId === a.id ? `0 0 20px ${style.text}15` : "none",
                    }}
                  >
                    {/* Main row */}
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    >
                      {/* Confidence dot */}
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: CONFIDENCE_COLORS[a.confidence] ?? "var(--foreground-dim)" }}
                        title={`Confidence: ${a.confidence}`}
                      />

                      {/* Claim */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: "var(--foreground)" }}>{a.claim}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" }}>
                            {a.category.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px]" style={{ color: CONFIDENCE_COLORS[a.confidence] }}>
                            {a.confidence}
                          </span>
                        </div>
                      </div>

                      {/* Status + Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: style.text }}>
                          {a.status}
                        </span>

                        {a.status === "PENDING" && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleConfirm(a.id); }}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded-md transition-all"
                              style={{ background: "rgba(16, 185, 129, 0.12)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" }}
                              title="Confirm — AI got this right"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setCorrectionId(isCorrecting ? null : a.id); setCorrectionText(""); }}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded-md transition-all"
                              style={{ background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.2)" }}
                              title="Correct — provide the right answer"
                            >
                              Correct
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(a.id); }}
                              disabled={isPending}
                              className="text-xs px-2 py-1 rounded-md transition-all"
                              style={{ background: "rgba(239, 68, 68, 0.12)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                              title="Reject — AI got this wrong"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Correction input */}
                    {isCorrecting && (
                      <div className="px-4 pb-3 animate-in" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          className="textarea-field text-sm mb-2"
                          style={{ minHeight: "70px" }}
                          placeholder="What is the correct answer? This will be injected into downstream AI agents as a verified constraint."
                          value={correctionText}
                          onChange={(e) => setCorrectionText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            className="btn-cyan text-xs"
                            disabled={!correctionText.trim() || isPending}
                            onClick={() => handleCorrect(a.id)}
                          >
                            Submit Correction
                          </button>
                          <button className="btn-ghost text-xs" onClick={() => { setCorrectionId(null); setCorrectionText(""); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && !isCorrecting && (
                      <div className="px-4 pb-3 space-y-2 animate-in border-t" style={{ borderColor: style.border }}>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--foreground-dim)" }}>Reasoning</p>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{a.reasoning}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--foreground-dim)" }}>Impact if Wrong</p>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{a.impact}</p>
                        </div>
                        {a.blocksPhases.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--foreground-dim)" }}>Blocks Phases</p>
                            <div className="flex gap-1 flex-wrap">
                              {a.blocksPhases.map((p) => (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-muted)" }}>
                                  {formatPhase(p)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {a.humanResponse && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: style.text }}>Human Response</p>
                            <p className="text-xs font-medium" style={{ color: style.text }}>{a.humanResponse}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper components
// ═══════════════════════════════════════════════════════════════════════════

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-glow flex items-center gap-3 py-2 px-3">
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
