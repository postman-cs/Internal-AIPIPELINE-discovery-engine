"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import {
  designMissileAction,
  designNukeAction,
  updateBlockerStatusAction,
  getBlockerDetailAction,
  launchNukeAction,
  fireMissileAction,
} from "@/lib/actions/blockers";
import { useToast } from "@/components/Toast";

const DESIGN_TIMEOUT_MS = 150_000;

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

interface MissileView {
  id: string; name: string; strategy: string; targetAudience: string | null;
  talkingPoints: unknown; actionSteps: unknown; deliverables: unknown;
  estimatedEffort: string | null; successCriteria: string | null;
  fallbackPlan: string | null; status: string;
  firedAt: string | null; resultNotes: string | null;
  aiGenerated: boolean; createdAt: string;
}

interface NukeView {
  id: string; name: string; rationale: string; strategy: string;
  escalationChain: unknown; collateralDamage: unknown;
  riskAssessment: string; pointOfNoReturn: string;
  phases: unknown; resources: unknown; timeline: string;
  bypassStrategy: string; bypassTradeoffs: string;
  successCriteria: string; failureContingency: string;
  status: string; armedAt: string | null; launchedAt: string | null;
  resultNotes: string | null; aiGenerated: boolean; createdAt: string;
}

interface BlockerDetail { missiles: MissileView[]; nukes: NukeView[]; }

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

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#10b981",
};
const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const STATUS_COLORS: Record<string, string> = {
  IDENTIFIED: "#fbbf24", MAPPED: "#60a5fa", MISSILE_DESIGNED: "#818cf8",
  MISSILE_FIRED: "#a78bfa", NUKE_ARMED: "#f97316", NUKE_LAUNCHED: "#ef4444",
  NEUTRALIZED: "#34d399", ACCEPTED: "var(--foreground-dim)", DORMANT: "var(--foreground-dim)",
};

const STATUS_FLOW = ["IDENTIFIED", "MAPPED", "MISSILE_DESIGNED", "MISSILE_FIRED", "NUKE_ARMED", "NUKE_LAUNCHED", "NEUTRALIZED"];

const DOMAIN_ICONS: Record<string, string> = {
  TECHNICAL: "T", ORGANIZATIONAL: "O", POLITICAL: "P", PROCESS: "R",
  KNOWLEDGE: "K", SECURITY: "S", LICENSING: "L", CULTURAL: "C",
};

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
  void _projectId;
  const dashboard = initialData.dashboard;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyBlockers, setBusyBlockers] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, BlockerDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!expandedId || details[expandedId]) return;
    setLoadingDetail(expandedId);
    getBlockerDetailAction(expandedId).then((r) => {
      if ("blocker" in r && r.blocker) {
        setDetails((prev) => ({
          ...prev,
          [expandedId]: { missiles: r.blocker!.missiles as MissileView[], nukes: r.blocker!.nukes as NukeView[] },
        }));
      }
      setLoadingDetail(null);
    });
  }, [expandedId, details]);

  const markBusy = useCallback((id: string, label: string) => {
    setBusyBlockers((prev) => ({ ...prev, [id]: label }));
  }, []);
  const clearBusy = useCallback((id: string) => {
    setBusyBlockers((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  function handleDesignMissile(blockerId: string) {
    markBusy(blockerId, "missile");
    startTransition(async () => {
      try {
        toast.info("Designing missile", "AI is crafting a targeted intervention...");
        const r = await Promise.race([
          designMissileAction(blockerId),
          new Promise<{ error: string }>((resolve) =>
            setTimeout(() => resolve({ error: "Design timed out. Please try again." }), DESIGN_TIMEOUT_MS)
          ),
        ]);
        if ("error" in r && r.error) toast.error("Design failed", r.error);
        else {
          toast.success("Missile designed", "Targeted intervention strategy ready");
          setDetails((prev) => { const n = { ...prev }; delete n[blockerId]; return n; });
        }
      } catch (e) {
        toast.error("Design failed", e instanceof Error ? e.message : "Unknown error");
      } finally { clearBusy(blockerId); }
    });
  }

  function handleDesignNuke(blockerId: string) {
    markBusy(blockerId, "nuke");
    startTransition(async () => {
      try {
        toast.info("Arming nuke", "AI is building a comprehensive elimination strategy...");
        const r = await Promise.race([
          designNukeAction(blockerId),
          new Promise<{ error: string }>((resolve) =>
            setTimeout(() => resolve({ error: "Design timed out. Please try again." }), DESIGN_TIMEOUT_MS)
          ),
        ]);
        if ("error" in r && r.error) toast.error("Design failed", r.error);
        else {
          toast.success("Nuke armed", "Comprehensive elimination strategy ready");
          setDetails((prev) => { const n = { ...prev }; delete n[blockerId]; return n; });
        }
      } catch (e) {
        toast.error("Design failed", e instanceof Error ? e.message : "Unknown error");
      } finally { clearBusy(blockerId); }
    });
  }

  function handleLaunchNuke(nukeId: string, blockerId: string) {
    startTransition(async () => {
      const r = await launchNukeAction(nukeId);
      if ("error" in r && r.error) toast.error("Launch failed", r.error);
      else {
        toast.success("Nuke launched", "Point of no return — strategy is now active");
        setDetails((prev) => { const n = { ...prev }; delete n[blockerId]; return n; });
      }
    });
  }

  function handleFireMissile(missileId: string, blockerId: string) {
    startTransition(async () => {
      const r = await fireMissileAction(missileId);
      if ("error" in r && r.error) toast.error("Fire failed", r.error);
      else {
        toast.success("Missile fired", "Intervention is now active");
        setDetails((prev) => { const n = { ...prev }; delete n[blockerId]; return n; });
      }
    });
  }

  function handleStatusChange(blockerId: string, status: string) {
    startTransition(async () => {
      const r = await updateBlockerStatusAction(blockerId, status);
      if ("error" in r && r.error) toast.error("Update failed", r.error);
      else toast.success("Status updated", `Blocker → ${status.replace(/_/g, " ")}`);
    });
  }

  if (!dashboard) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 page-animate">
        <EmptyState />
      </div>
    );
  }

  const allBlockers = [...dashboard.activeBlockers];
  for (const cb of dashboard.criticalBlockers) {
    if (!allBlockers.find((b) => b.id === cb.id)) allBlockers.push(cb);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 page-animate">
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.15))",
            border: "1px solid rgba(239,68,68,0.15)",
            boxShadow: dashboard.overallRiskScore > 50 ? "0 0 20px rgba(239,68,68,0.15)" : "none",
          }}
        >
          <CrosshairIcon />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Blocker Command Center
          </h1>
          <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
            Map, target, and neutralize adoption blockers
          </p>
        </div>
      </div>

      {/* ═══ Dashboard Grid ═══ */}
      <div className="grid grid-cols-12 gap-3 mb-8">
        {/* Risk Gauge */}
        <div
          className="col-span-3 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <RiskGauge score={dashboard.overallRiskScore} />
          <p className="text-[10px] uppercase tracking-wider mt-2" style={{ color: "var(--foreground-dim)" }}>
            Threat Level
          </p>
        </div>

        {/* Stats */}
        <div className="col-span-5 grid grid-cols-3 gap-2">
          <MetricTile
            label="Active" value={dashboard.activeBlockers.length}
            color="#fbbf24" icon={<AlertIcon />}
          />
          <MetricTile
            label="Critical" value={dashboard.criticalBlockers.length}
            color="#ef4444" icon={<FlameIcon />}
          />
          <MetricTile
            label="Resolved" value={dashboard.resolvedBlockers}
            color="#34d399" icon={<CheckCircleIcon />}
          />
          <MetricTile
            label="Total" value={dashboard.totalBlockers}
            color="var(--foreground-muted)" icon={<StackIcon />}
          />
          <MetricTile
            label="Blocked Phases" value={dashboard.blockedPhaseCount}
            color="#a78bfa" icon={<LockIcon />}
          />
          <MetricTile
            label="Domains Hit" value={Object.keys(dashboard.byDomain).length}
            color="#06d6d6" icon={<GridIcon />}
          />
        </div>

        {/* Severity Breakdown */}
        <div
          className="col-span-4 rounded-xl p-4 relative overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-3" style={{ color: "var(--foreground-dim)" }}>
            Severity Distribution
          </p>
          <div className="space-y-2">
            {SEVERITY_ORDER.map((sev) => {
              const count = dashboard.bySeverity[sev] ?? 0;
              const pct = dashboard.totalBlockers > 0 ? (count / dashboard.totalBlockers) * 100 : 0;
              const color = SEVERITY_COLORS[sev]!;
              return (
                <div key={sev} className="flex items-center gap-2">
                  <span className="text-[9px] w-14 uppercase tracking-wider font-semibold" style={{ color }}>{sev}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}80)`,
                        boxShadow: count > 0 ? `0 0 8px ${color}40` : "none",
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold w-4 text-right tabular-nums" style={{ color }}>{count}</span>
                </div>
              );
            })}
          </div>
          {dashboard.topBlockedPhases.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "var(--foreground-dim)" }}>
                Top Blocked Phases
              </p>
              <div className="flex flex-wrap gap-1">
                {dashboard.topBlockedPhases.slice(0, 4).map(({ phase, blockerCount }) => (
                  <span
                    key={phase}
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.1)" }}
                  >
                    {phase.replace(/_/g, " ")} ({blockerCount})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Blocker List ═══ */}
      {allBlockers.length === 0 ? (
        <div
          className="rounded-xl p-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.08)" }}>
            <CheckCircleIcon />
          </div>
          <p className="text-sm" style={{ color: "#34d399" }}>All clear — no active blockers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allBlockers.map((b) => {
            const isExpanded = expandedId === b.id;
            const sevColor = SEVERITY_COLORS[b.severity] ?? "var(--foreground-dim)";
            const statusColor = STATUS_COLORS[b.status] ?? "var(--foreground-dim)";
            const domainIcon = DOMAIN_ICONS[b.domain] ?? "?";
            const busy = busyBlockers[b.id];

            return (
              <div
                key={b.id}
                className="rounded-xl overflow-hidden transition-all duration-300 relative"
                style={{
                  background: isExpanded ? `${sevColor}03` : "var(--surface)",
                  border: `1px solid ${isExpanded ? `${sevColor}25` : "var(--border)"}`,
                }}
              >
                {/* Top glow for critical/high */}
                {(b.severity === "CRITICAL" || b.severity === "HIGH") && (
                  <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(to right, ${sevColor}60, ${sevColor}15, transparent)` }}
                  />
                )}

                {/* Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                >
                  {/* Impact gauge */}
                  <div className="relative w-11 h-11 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-11 h-11">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={sevColor} strokeWidth="2.5"
                        strokeDasharray={`${b.impactScore}, 100`}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                        style={{ filter: `drop-shadow(0 0 4px ${sevColor}40)`, transition: "stroke-dasharray 0.5s ease" }}
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
                      style={{ color: sevColor }}
                    >
                      {b.impactScore}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{b.title}</h3>
                      <SeverityBadge severity={b.severity} />
                      <StatusBadge status={b.status} color={statusColor} />
                    </div>
                    <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>{b.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <DomainChip domain={b.domain} icon={domainIcon} />
                      {b.missileCount > 0 && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: "#a78bfa" }}>
                          <MissileIconSmall /> {b.missileCount}
                        </span>
                      )}
                      {b.nukeCount > 0 && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: "#f97316" }}>
                          <NukeIconSmall /> {b.nukeCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="var(--foreground-dim)" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* ═══ Expanded Detail ═══ */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 animate-in" style={{ borderTop: `1px solid ${sevColor}10` }}>
                    {/* Status flow */}
                    <div className="pt-3">
                      <p className="text-[9px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--foreground-dim)" }}>
                        Status Progression
                      </p>
                      <div className="flex items-center gap-1">
                        {STATUS_FLOW.map((s, i) => {
                          const isActive = s === b.status;
                          const isPast = STATUS_FLOW.indexOf(b.status) > i;
                          const sColor = STATUS_COLORS[s] ?? "var(--foreground-dim)";
                          return (
                            <div key={s} className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(b.id, s); }}
                                disabled={isPending || isActive}
                                className="text-[8px] px-2 py-1 rounded-full transition-all uppercase tracking-wider font-semibold"
                                style={{
                                  background: isActive ? `${sColor}20` : isPast ? `${sColor}08` : "rgba(255,255,255,0.02)",
                                  color: isActive ? sColor : isPast ? `${sColor}80` : "var(--foreground-dim)",
                                  border: `1px solid ${isActive ? `${sColor}40` : "transparent"}`,
                                  boxShadow: isActive ? `0 0 8px ${sColor}20` : "none",
                                }}
                              >
                                {s.replace(/_/g, " ")}
                              </button>
                              {i < STATUS_FLOW.length - 1 && (
                                <div
                                  className="w-3 h-px"
                                  style={{ background: isPast ? `${sColor}40` : "var(--border)" }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {b.rootCause && (
                        <InfoBlock label="Root Cause" icon={<SearchIcon />}>
                          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{b.rootCause}</p>
                        </InfoBlock>
                      )}
                      {b.blockedPhases.length > 0 && (
                        <InfoBlock label="Blocked Phases" icon={<LockIcon />}>
                          <div className="flex gap-1 flex-wrap">
                            {b.blockedPhases.map((p) => (
                              <span key={p} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.08)" }}>
                                {p.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </InfoBlock>
                      )}
                      {b.blockedCapabilities.length > 0 && (
                        <InfoBlock label="Blocked Capabilities" icon={<GridIcon />}>
                          <div className="flex gap-1 flex-wrap">
                            {b.blockedCapabilities.map((c) => (
                              <span key={c} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.06)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.08)" }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </InfoBlock>
                      )}
                      {(b.blockerOwner || b.decisionMaker) && (
                        <InfoBlock label="Stakeholders" icon={<UsersIcon />}>
                          {b.blockerOwner && <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Owner: <span style={{ color: "var(--foreground)" }}>{b.blockerOwner}</span></p>}
                          {b.decisionMaker && <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Decision Maker: <span style={{ color: "var(--foreground)" }}>{b.decisionMaker}</span></p>}
                        </InfoBlock>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className="rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-200 group"
                        style={{
                          background: busy === "missile" ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.06)",
                          border: "1px solid rgba(139,92,246,0.2)",
                          color: "#a78bfa",
                        }}
                        onClick={() => handleDesignMissile(b.id)}
                        disabled={!!busy || isPending}
                      >
                        {busy === "missile" ? (
                          <span className="text-xs animate-pulse">Designing missile...</span>
                        ) : (
                          <>
                            <MissileIconSmall />
                            <span className="text-xs font-semibold">Design Missile</span>
                            {b.missileCount > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.15)" }}>{b.missileCount}</span>
                            )}
                          </>
                        )}
                      </button>
                      <button
                        className="rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-200 group"
                        style={{
                          background: busy === "nuke" ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.06)",
                          border: "1px solid rgba(249,115,22,0.2)",
                          color: "#f97316",
                        }}
                        onClick={() => handleDesignNuke(b.id)}
                        disabled={!!busy || isPending}
                      >
                        {busy === "nuke" ? (
                          <span className="text-xs animate-pulse">Arming nuke...</span>
                        ) : (
                          <>
                            <NukeIconSmall />
                            <span className="text-xs font-semibold">Design Nuke</span>
                            {b.nukeCount > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.15)" }}>{b.nukeCount}</span>
                            )}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Loading state */}
                    {loadingDetail === b.id && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: sevColor }} />
                        <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>Loading strategies...</span>
                      </div>
                    )}

                    {/* Missiles */}
                    {details[b.id]?.missiles.map((m) => (
                      <MissileCard key={m.id} missile={m} blockerId={b.id} onFire={handleFireMissile} isPending={isPending} />
                    ))}

                    {/* Nukes */}
                    {details[b.id]?.nukes.map((n) => (
                      <NukeCard key={n.id} nuke={n} blockerId={b.id} onLaunch={handleLaunchNuke} isPending={isPending} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Missile Card
// ═══════════════════════════════════════════════════════════════════════════

function MissileCard({ missile: m, blockerId, onFire, isPending }: {
  missile: MissileView; blockerId: string;
  onFire: (missileId: string, blockerId: string) => void; isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const statusColors: Record<string, string> = { designed: "#a78bfa", fired: "#fbbf24", hit: "#34d399", missed: "#ef4444" };
  const color = statusColors[m.status] ?? "#a78bfa";

  const talkingPoints = (Array.isArray(m.talkingPoints) ? m.talkingPoints : []) as Array<{ point?: string; evidence?: string }>;
  const actionSteps = (Array.isArray(m.actionSteps) ? m.actionSteps : []) as Array<{ order?: number; action?: string; owner?: string; timeline?: string }>;

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: open ? "rgba(139,92,246,0.03)" : "rgba(139,92,246,0.01)",
        border: "1px solid rgba(139,92,246,0.15)",
      }}
    >
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(to right, rgba(139,92,246,0.4), transparent)" }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer" onClick={() => setOpen(!open)}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <MissileIconSmall />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>{m.name}</span>
        </div>
        <span
          className="text-[9px] uppercase px-2 py-0.5 rounded-full font-semibold"
          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
        >
          {m.status}
        </span>
        {m.aiGenerated && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.08)", color: "#a78bfa" }}>AI</span>
        )}
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="#a78bfa" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
          {/* Strategy & target */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <InfoBlock label="Strategy" icon={<MissileIconSmall />} color="rgba(139,92,246,0.5)">
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{m.strategy}</p>
            </InfoBlock>
            {m.targetAudience && (
              <InfoBlock label="Target Audience" icon={<UsersIcon />} color="rgba(139,92,246,0.5)">
                <p className="text-xs" style={{ color: "var(--foreground)" }}>{m.targetAudience}</p>
              </InfoBlock>
            )}
          </div>

          {/* Talking Points */}
          {talkingPoints.length > 0 && (
            <div>
              <SectionLabel label="Tactical Briefing" color="#a78bfa" />
              <div className="space-y-1.5 ml-1">
                {talkingPoints.map((tp, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md px-2.5 py-2" style={{ background: "rgba(139,92,246,0.04)" }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>{i + 1}</div>
                    <div className="min-w-0">
                      <p className="text-xs" style={{ color: "var(--foreground)" }}>{tp.point}</p>
                      {tp.evidence && <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>Evidence: {tp.evidence}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Steps - Mission Timeline */}
          {actionSteps.length > 0 && (
            <div>
              <SectionLabel label="Mission Timeline" color="#a78bfa" />
              <div className="relative ml-3">
                <div className="absolute left-2.5 top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, rgba(139,92,246,0.3), rgba(139,92,246,0.05))" }} />
                <div className="space-y-1.5">
                  {actionSteps.map((s, i) => (
                    <div key={i} className="relative pl-8 py-1.5">
                      <div
                        className="absolute left-0 top-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
                      >
                        {s.order ?? i + 1}
                      </div>
                      <p className="text-xs" style={{ color: "var(--foreground)" }}>{s.action}</p>
                      {(s.owner || s.timeline) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.owner && <span className="text-[10px]" style={{ color: "#a78bfa" }}>{s.owner}</span>}
                          {s.timeline && <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{s.timeline}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Success / Fallback */}
          <div className="grid grid-cols-2 gap-3">
            {m.successCriteria && (
              <div className="rounded-md px-3 py-2" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}>
                <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "#34d399" }}>Success Criteria</p>
                <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{m.successCriteria}</p>
              </div>
            )}
            {m.fallbackPlan && (
              <div className="rounded-md px-3 py-2" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)" }}>
                <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "#fbbf24" }}>Fallback Plan</p>
                <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{m.fallbackPlan}</p>
              </div>
            )}
          </div>

          {/* Fire button */}
          {m.status === "designed" && (
            <button
              className="w-full rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))",
                border: "1px solid rgba(139,92,246,0.3)",
                color: "#a78bfa",
                boxShadow: "0 0 12px rgba(139,92,246,0.1)",
              }}
              onClick={() => onFire(m.id, blockerId)}
              disabled={isPending}
            >
              <MissileIconSmall />
              <span className="text-xs font-bold">Fire Missile</span>
            </button>
          )}

          {m.firedAt && <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Fired: {new Date(m.firedAt).toLocaleDateString()}</p>}
          {m.resultNotes && (
            <div className="rounded-md px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--foreground-dim)" }}>Result</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{m.resultNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Nuke Card
// ═══════════════════════════════════════════════════════════════════════════

function NukeCard({ nuke: n, blockerId, onLaunch, isPending }: {
  nuke: NukeView; blockerId: string;
  onLaunch: (nukeId: string, blockerId: string) => void; isPending: boolean;
}) {
  const [open, setOpen] = useState(true);
  const statusColors: Record<string, string> = { designed: "#f97316", armed: "#ef4444", launched: "#dc2626", detonated: "#34d399", failed: "#6b7280" };
  const color = statusColors[n.status] ?? "#f97316";

  const escalation = (Array.isArray(n.escalationChain) ? n.escalationChain : []) as Array<{ order?: number; person?: string; role?: string; approach?: string; keyMessage?: string }>;
  const collateral = (Array.isArray(n.collateralDamage) ? n.collateralDamage : []) as Array<{ area?: string; impact?: string; mitigation?: string }>;
  const phases = (Array.isArray(n.phases) ? n.phases : []) as Array<{ order?: number; name?: string; actions?: string[]; duration?: string; successGate?: string }>;
  const resources = (Array.isArray(n.resources) ? n.resources : []) as Array<{ type?: string; description?: string; availability?: string }>;

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: "rgba(249,115,22,0.02)",
        border: "1px solid rgba(249,115,22,0.2)",
      }}
    >
      {/* Danger stripe */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.8), rgba(239,68,68,0.6), rgba(249,115,22,0.3), transparent)" }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(239,68,68,0.15))",
            border: "1px solid rgba(249,115,22,0.25)",
            boxShadow: "0 0 12px rgba(249,115,22,0.1)",
          }}
        >
          <NukeIconSmall />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold" style={{ color: "#f97316" }}>{n.name}</span>
        </div>
        <span
          className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold"
          style={{
            background: `${color}15`, color,
            border: `1px solid ${color}30`,
            boxShadow: n.status === "launched" ? `0 0 8px ${color}30` : "none",
          }}
        >
          {n.status}
        </span>
        {n.aiGenerated && (
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.08)", color: "#f97316" }}>AI</span>
        )}
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(249,115,22,0.1)" }}>
          {/* Rationale & Strategy */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.08)" }}>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#f97316" }}>Rationale</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.rationale}</p>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.08)" }}>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#f97316" }}>Strategy</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.strategy}</p>
            </div>
          </div>

          {/* Escalation Chain */}
          {escalation.length > 0 && (
            <div>
              <SectionLabel label="Escalation Chain" color="#f97316" icon={<EscalationIcon />} />
              <div className="relative ml-3 mt-2">
                <div className="absolute left-3 top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, rgba(249,115,22,0.5), rgba(239,68,68,0.3), rgba(249,115,22,0.05))" }} />
                <div className="space-y-2">
                  {escalation.map((e, i) => (
                    <div key={i} className="relative pl-10">
                      <div
                        className="absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: i === 0 ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.1)",
                          color: "#f97316",
                          border: `2px solid rgba(249,115,22,${0.5 - i * 0.1})`,
                          boxShadow: i === 0 ? "0 0 8px rgba(249,115,22,0.2)" : "none",
                        }}
                      >
                        {e.order ?? i + 1}
                      </div>
                      <div className="rounded-lg px-3 py-2" style={{ background: "rgba(249,115,22,0.03)", border: "1px solid rgba(249,115,22,0.06)" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{e.person}</span>
                          {e.role && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.08)", color: "#f97316" }}>{e.role}</span>}
                        </div>
                        {e.approach && <p className="text-[11px] mt-1" style={{ color: "var(--foreground-muted)" }}>{e.approach}</p>}
                        {e.keyMessage && (
                          <div className="mt-1 flex items-start gap-1">
                            <span className="text-[9px] shrink-0 mt-0.5" style={{ color: "var(--foreground-dim)" }}>Key:</span>
                            <p className="text-[10px] italic" style={{ color: "#f97316" }}>&ldquo;{e.keyMessage}&rdquo;</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Execution Phases */}
          {phases.length > 0 && (
            <div>
              <SectionLabel label="Execution Phases" color="#f97316" icon={<PhaseIcon />} />
              <div className="mt-2 space-y-2">
                {phases.map((p, i) => (
                  <div key={i} className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.08)" }}>
                    <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "rgba(249,115,22,0.04)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                          Phase {p.order ?? i + 1}
                        </span>
                        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{p.name}</span>
                      </div>
                      {p.duration && <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{p.duration}</span>}
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {p.actions?.map((a, j) => (
                        <div key={j} className="flex items-start gap-1.5">
                          <span className="text-[10px] mt-0.5" style={{ color: "#f97316" }}>&#9654;</span>
                          <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{a}</span>
                        </div>
                      ))}
                      {p.successGate && (
                        <div className="flex items-center gap-1.5 mt-1 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                          <CheckCircleIcon small />
                          <span className="text-[10px]" style={{ color: "#34d399" }}>Gate: {p.successGate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collateral Damage */}
          {collateral.length > 0 && (
            <div>
              <SectionLabel label="Collateral Damage Assessment" color="#ef4444" icon={<WarningIcon />} />
              <div className="mt-2 space-y-1.5">
                {collateral.map((c, i) => (
                  <div key={i} className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)" }}>
                    <div className="w-1 h-8 rounded-full shrink-0 mt-0.5" style={{ background: "#ef4444" }} />
                    <div className="min-w-0">
                      <p className="text-xs"><span className="font-semibold" style={{ color: "var(--foreground)" }}>{c.area}</span></p>
                      <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{c.impact}</p>
                      {c.mitigation && (
                        <p className="text-[10px] mt-0.5" style={{ color: "#34d399" }}>Mitigation: {c.mitigation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk / Point of No Return */}
          <div className="grid grid-cols-2 gap-3">
            {n.riskAssessment && (
              <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.1)" }}>
                <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#fbbf24" }}>Risk Assessment</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.riskAssessment}</p>
              </div>
            )}
            {n.pointOfNoReturn && (
              <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#ef4444" }}>Point of No Return</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.pointOfNoReturn}</p>
              </div>
            )}
          </div>

          {/* Resources */}
          {resources.length > 0 && (
            <div>
              <SectionLabel label="Required Resources" color="var(--foreground-dim)" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                {resources.map((r, i) => (
                  <div key={i} className="rounded-md px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ background: "rgba(249,115,22,0.06)", color: "#f97316" }}>{r.type}</span>
                    <p className="text-[11px] mt-1" style={{ color: "var(--foreground-muted)" }}>{r.description}</p>
                    {r.availability && <p className="text-[9px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>Availability: {r.availability}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bypass + Timeline */}
          <div className="grid grid-cols-2 gap-3">
            {n.bypassStrategy && (
              <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(6,214,214,0.03)", border: "1px solid rgba(6,214,214,0.1)" }}>
                <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#06d6d6" }}>Bypass Strategy</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.bypassStrategy}</p>
                {n.bypassTradeoffs && <p className="text-[10px] mt-1" style={{ color: "var(--foreground-dim)" }}>Tradeoffs: {n.bypassTradeoffs}</p>}
              </div>
            )}
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--foreground-dim)" }}>Timeline</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.timeline}</p>
              {n.successCriteria && <p className="text-[10px] mt-1" style={{ color: "#34d399" }}>Success: {n.successCriteria}</p>}
            </div>
          </div>

          {/* Failure Contingency */}
          {n.failureContingency && (
            <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(239,68,68,0.02)", border: "1px solid rgba(239,68,68,0.08)" }}>
              <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--foreground-dim)" }}>If the Nuke Fails</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.failureContingency}</p>
            </div>
          )}

          {/* Launch button */}
          {(n.status === "designed" || n.status === "armed") && (
            <button
              className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-all duration-300 group"
              style={{
                background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(239,68,68,0.2))",
                border: "1px solid rgba(249,115,22,0.4)",
                color: "#f97316",
                boxShadow: "0 0 20px rgba(249,115,22,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
              onClick={() => onLaunch(n.id, blockerId)}
              disabled={isPending}
            >
              <svg className="w-5 h-5 group-hover:animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
                <circle cx="12" cy="12" r="4" fill="currentColor" opacity={0.3} />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
              <span className="text-sm font-bold tracking-wide">LAUNCH NUKE</span>
            </button>
          )}

          {n.launchedAt && <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Launched: {new Date(n.launchedAt).toLocaleDateString()}</p>}
          {n.resultNotes && (
            <div className="rounded-md px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--foreground-dim)" }}>Result</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{n.resultNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <CrosshairIcon />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Blocker Command Center</h1>
          <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>Map, target, and neutralize adoption blockers</p>
        </div>
      </div>
      <div className="rounded-xl p-16 text-center relative overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(6,214,214,0.02), transparent 70%)" }} />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.1)" }}>
            <CheckCircleIcon />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>No blockers detected</p>
          <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
            Blockers are automatically surfaced by AI agents during the cascade.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-3 relative overflow-hidden"
      style={{ background: `${color}06`, border: `1px solid ${color}12` }}
    >
      <div className="absolute top-1.5 right-1.5 opacity-20" style={{ color }}>{icon}</div>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const color = score > 70 ? "#ef4444" : score > 40 ? "#f59e0b" : score > 15 ? "#3b82f6" : "#10b981";
  const label = score > 70 ? "CRITICAL" : score > 40 ? "HIGH" : score > 15 ? "ELEVATED" : "LOW";
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 36 36" className="w-20 h-20">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${score}, 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ filter: `drop-shadow(0 0 6px ${color}50)`, transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[7px] uppercase tracking-widest font-bold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLORS[severity] ?? "var(--foreground-dim)";
  return (
    <span
      className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}
    >
      {severity}
    </span>
  );
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  return (
    <span
      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${color}10`, color }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DomainChip({ domain, icon }: { domain: string; icon: string }) {
  return (
    <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--foreground-dim)" }}>
      <span className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold" style={{ background: "rgba(6,214,214,0.06)", color: "#06d6d6" }}>{icon}</span>
      {domain.replace(/_/g, " ")}
    </span>
  );
}

function InfoBlock({ label, icon, children, color }: { label: string; icon: React.ReactNode; children: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div style={{ color: color ?? "var(--foreground-dim)" }}>{icon}</div>
        <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--foreground-dim)" }}>{label}</p>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ label, color, icon }: { label: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <div style={{ color }}>{icon}</div>}
      <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color }}>{label}</p>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${color}30, transparent)` }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════════════════════════════════

function CrosshairIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  );
}

function CheckCircleIcon({ small }: { small?: boolean } = {}) {
  return (
    <svg className={small ? "w-3 h-3" : "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke={small ? "#34d399" : "currentColor"} strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function MissileIconSmall() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function NukeIconSmall() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity={0.2} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function EscalationIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
    </svg>
  );
}

function PhaseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
