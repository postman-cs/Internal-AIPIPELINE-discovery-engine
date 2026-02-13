"use client";

import { useState, useTransition } from "react";
import {
  designMissileAction,
  designNukeAction,
  updateBlockerStatusAction,
} from "@/lib/actions/blockers";
import { useToast } from "@/components/Toast";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface BlockerMapView {
  id: string; title: string; description: string;
  domain: string; severity: string; status: string;
  impactScore: number; blockedPhases: string[]; blockedCapabilities: string[];
  rootCause: string | null; blockerOwner: string | null; decisionMaker: string | null;
  missileCount: number; nukeCount: number; createdAt: string;
}

interface BlockerDashboard {
  totalBlockers: number;
  bySeverity: Record<string, number>;
  byDomain: Record<string, number>;
  byStatus: Record<string, number>;
  criticalBlockers: BlockerMapView[];
  activeBlockers: BlockerMapView[];
  resolvedBlockers: number;
  blockedPhaseCount: number;
  topBlockedPhases: Array<{ phase: string; blockerCount: number }>;
  overallRiskScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Panel
// ═══════════════════════════════════════════════════════════════════════════

export function BlockersPanel({
  projectId: _projectId,
  initialData,
}: {
  projectId: string;
  initialData: { dashboard?: BlockerDashboard; error?: string };
}) {
  void _projectId; // reserved for future use
  const dashboard = initialData.dashboard;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleDesignMissile(blockerId: string) {
    startTransition(async () => {
      toast.info("Designing missile", "AI is crafting a targeted intervention...");
      const r = await designMissileAction(blockerId);
      if ("error" in r && r.error) toast.error("Design failed", r.error);
      else toast.success("Missile designed", "AI-powered intervention strategy ready");
    });
  }

  function handleDesignNuke(blockerId: string) {
    startTransition(async () => {
      toast.info("Designing nuke", "AI is building a comprehensive elimination strategy...");
      const r = await designNukeAction(blockerId);
      if ("error" in r && r.error) toast.error("Design failed", r.error);
      else toast.success("Nuke designed", "Comprehensive elimination strategy ready");
    });
  }

  function handleStatusChange(blockerId: string, status: string) {
    startTransition(async () => {
      const r = await updateBlockerStatusAction(blockerId, status);
      if ("error" in r && r.error) toast.error("Update failed", r.error);
      else toast.success("Status updated", `Blocker status changed to ${status.replace(/_/g, " ")}`);
    });
  }

  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "var(--foreground-dim)",
  };
  const STATUS_COLORS: Record<string, string> = {
    IDENTIFIED: "#fbbf24", MAPPED: "#60a5fa", MISSILE_DESIGNED: "#818cf8",
    MISSILE_FIRED: "#a78bfa", NUKE_ARMED: "#f97316", NUKE_LAUNCHED: "#ef4444",
    NEUTRALIZED: "#34d399", ACCEPTED: "var(--foreground-dim)", DORMANT: "var(--foreground-dim)",
  };

  if (!dashboard) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <h1 className="text-2xl font-bold mb-4" style={{ color: "var(--foreground)" }}>Blockers</h1>
        <div className="card text-center py-16">
          <p className="text-3xl mb-3" style={{ color: "var(--foreground-dim)" }}>&#9888;</p>
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            No blockers detected yet. Blockers are automatically surfaced by AI agents during the cascade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 page-animate">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Blocker Command Center</h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Map, target, and neutralize adoption blockers
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatPill label="Total" value={dashboard.totalBlockers} color="var(--foreground)" />
        <StatPill label="Active" value={dashboard.activeBlockers.length} color="#fbbf24" />
        <StatPill label="Critical" value={dashboard.criticalBlockers.length} color="#ef4444" />
        <StatPill label="Resolved" value={dashboard.resolvedBlockers} color="#34d399" />
        <StatPill label="Blocked Phases" value={dashboard.blockedPhaseCount} color="#a78bfa" />
        <StatPill label="Risk Score" value={dashboard.overallRiskScore} color={dashboard.overallRiskScore > 50 ? "#ef4444" : dashboard.overallRiskScore > 25 ? "#f59e0b" : "#34d399"} />
      </div>

      {/* All blockers (active first, then critical for highlights) */}
      {(() => {
        const allBlockers = [...dashboard.activeBlockers];
        // Add critical blockers not already in active list
        for (const cb of dashboard.criticalBlockers) {
          if (!allBlockers.find((b) => b.id === cb.id)) allBlockers.push(cb);
        }
        if (allBlockers.length === 0) {
          return (
            <div className="card text-center py-16">
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No active blockers. All clear.</p>
            </div>
          );
        }
        return (
          <div className="space-y-3">
            {allBlockers.map((b) => {
              const isExpanded = expandedId === b.id;
              const sevColor = SEVERITY_COLORS[b.severity] ?? "var(--foreground-dim)";
              const statusColor = STATUS_COLORS[b.status] ?? "var(--foreground-dim)";

              return (
                <div key={b.id} className="card transition-all duration-200" style={{ borderColor: `${sevColor}20` }}>
                  {/* Header row */}
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                    <div className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ background: sevColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{b.title}</h3>
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ background: `${sevColor}15`, color: sevColor }}>
                          {b.severity}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${statusColor}15`, color: statusColor }}>
                          {b.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>{b.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{b.domain.replace(/_/g, " ")}</span>
                        <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                          {b.missileCount} missile{b.missileCount !== 1 ? "s" : ""} | {b.nukeCount} nuke{b.nukeCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold tabular-nums" style={{ color: sevColor }}>{b.impactScore}</div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Impact</div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 space-y-4 animate-in" style={{ borderTop: "1px solid var(--border)" }}>
                      {b.rootCause && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--foreground-dim)" }}>Root Cause</p>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{b.rootCause}</p>
                        </div>
                      )}

                      {b.blockedPhases.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--foreground-dim)" }}>Blocked Phases</p>
                          <div className="flex gap-1 flex-wrap">
                            {b.blockedPhases.map((p) => (
                              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
                                {p.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status actions */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>Update Status</p>
                        <div className="flex gap-1 flex-wrap">
                          {["IDENTIFIED", "MAPPED", "NEUTRALIZED", "ACCEPTED", "DORMANT"].map((s) => (
                            <button
                              key={s}
                              className="text-[10px] px-2 py-1 rounded transition-all"
                              disabled={isPending || b.status === s}
                              style={{
                                background: b.status === s ? `${STATUS_COLORS[s]}20` : "rgba(255,255,255,0.03)",
                                color: b.status === s ? STATUS_COLORS[s] : "var(--foreground-dim)",
                                border: `1px solid ${b.status === s ? STATUS_COLORS[s] + "40" : "var(--border)"}`,
                              }}
                              onClick={() => handleStatusChange(b.id, s)}
                            >
                              {s.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Missile + Nuke design buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-lg p-3" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#a78bfa" }}>Missiles</p>
                            <span className="text-xs tabular-nums" style={{ color: "#a78bfa" }}>{b.missileCount}</span>
                          </div>
                          <p className="text-[10px] mb-2" style={{ color: "var(--foreground-dim)" }}>Targeted interventions to weaken the blocker.</p>
                          <button
                            className="text-[10px] px-3 py-1.5 rounded w-full transition-all"
                            style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                            onClick={() => handleDesignMissile(b.id)}
                            disabled={isPending}
                          >
                            {isPending ? "Designing..." : "AI Design Missile"}
                          </button>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#f97316" }}>Nukes</p>
                            <span className="text-xs tabular-nums" style={{ color: "#f97316" }}>{b.nukeCount}</span>
                          </div>
                          <p className="text-[10px] mb-2" style={{ color: "var(--foreground-dim)" }}>Comprehensive elimination strategies.</p>
                          <button
                            className="text-[10px] px-3 py-1.5 rounded w-full transition-all"
                            style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" }}
                            onClick={() => handleDesignNuke(b.id)}
                            disabled={isPending}
                          >
                            {isPending ? "Designing..." : "AI Design Nuke"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-glow flex flex-col items-start py-2 px-3">
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}
