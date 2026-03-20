import Link from "next/link";
import { getAdmiralDashboardData, getFleetCascadeHealth } from "@/lib/actions/admin";
import { getLeaderboard, getRecentXpEvents } from "@/lib/gamification/xp-engine";
import { FleetCommandMapWrapper } from "./FleetCommandMapWrapper";
import type { FleetCSE } from "./FleetCommandMapWrapper";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";
import { StageAdvanceButton } from "./StageAdvanceButton";
import { ExportDashboardButton } from "./ExportDashboardButton";
import { DashboardQuickPanels } from "./DashboardQuickPanels";
import XpLeaderboard from "./XpLeaderboard";

export default async function AdmiralDashboard() {
  const [{ stats, fleet, recentNotes, recentTasks }, cascadeHealth, xpLeaderboard, xpRecentEvents, unassignedProjects] = await Promise.all([
    getAdmiralDashboardData(),
    getFleetCascadeHealth(),
    getLeaderboard(),
    getRecentXpEvents(undefined, 15),
    import("@/lib/prisma").then(({ prisma }) =>
      prisma.project.findMany({
        where: { ownerUserId: null, status: { not: "completed" } },
        select: { id: true, name: true, primaryDomain: true, engagementStage: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      })
    ),
  ]);

  const totalLoad = fleet.reduce((n, c) => n + c._count.projects, 0);
  const totalBlockers = fleet.reduce((n, c) => n + c.activeBlockers, 0);

  // Build XP level lookup from leaderboard data
  const xpLevelByUserId = new Map(xpLeaderboard.map((e) => [e.id, e.xpLevel]));

  // Transform fleet data for the Fleet Command Map visualisation
  const fleetViz: FleetCSE[] = fleet
    .filter((c) => c.email !== "cse@postman.com")
    .map((cse) => ({
      id: cse.id,
      name: cse.name,
      email: cse.email,
      projectCount: cse._count.projects,
      activeBlockers: cse.activeBlockers,
      pendingAssumptions: cse.pendingAssumptions,
      totalPhases: cse.totalPhases,
      ingestCount: cse._count.ingestRuns,
      xpLevel: xpLevelByUserId.get(cse.id) ?? 1,
      projects: cse.projects.map((p) => ({
        id: p.id,
        name: p.name,
        domain: p.primaryDomain || "unknown",
        engagementStage: p.engagementStage,
        phaseCount: p._count.phaseArtifacts,
        blockerCount: p._count.blockers,
        assumptionCount: p._count.assumptions,
        lastUpdated: new Date(p.updatedAt).getTime(),
      })),
    }));

  const fleetStats = {
    totalProjects: totalLoad,
    totalBlockers,
    totalCSEs: fleetViz.length,
  };

  const cseUsers = fleet
    .filter((c) => c.email !== "cse@postman.com")
    .map((c) => ({ id: c.id, name: c.name }));

  const totalTeamXp = xpLeaderboard.reduce((sum, e) => sum + e.xp, 0);

  const statCards = [
    { label: "CSEs", value: fleet.length, href: "/admiral/users", color: "#22c55e" },
    { label: "Total Engagements", value: stats.projectCount, href: "/admiral/projects", color: "#06d6d6" },
    { label: "Active Blockers", value: totalBlockers, href: "/admiral/blockers", color: "#ef4444" },
    { label: "Team XP", value: totalTeamXp, href: "#xp-leaderboard", color: "#fbbf24" },
    { label: "Documents", value: stats.docCount, href: "#", color: "#3b82f6" },
    { label: "AI Runs", value: stats.aiRunCount, href: "#", color: "#8b5cf6" },
  ];

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Admiral&apos;s Bridge</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Fleet overview &middot; {fleet.length} CSEs &middot; {totalLoad} engagements
          </p>
        </div>
        <ExportDashboardButton data={{ stats, fleet }} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {statCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card-glow flex flex-col items-start py-4 px-4 transition-all duration-200 group"
          >
            <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{c.label}</p>
          </Link>
        ))}
      </div>

      {/* Engagement Stage Pipeline */}
      <EngagementStagePipeline fleet={fleet} />

      {/* Unassigned Projects */}
      {unassignedProjects.length > 0 && (
        <div className="mb-8 card-glow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
              Unassigned Engagements ({unassignedProjects.length})
            </h2>
            <Link href="/admiral/projects" className="text-[10px]" style={{ color: "var(--accent-cyan)" }}>
              View all →
            </Link>
          </div>
          <div className="space-y-1">
            {unassignedProjects.slice(0, 6).map((p) => {
              const stg = ENGAGEMENT_STAGES[p.engagementStage] ?? ENGAGEMENT_STAGES[0];
              return (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded text-xs transition-colors hover:bg-white/5"
                  style={{ borderLeft: "2px solid #f59e0b" }}>
                  <Link href={`/projects/${p.id}`} className="flex-1 truncate" style={{ color: "var(--foreground-muted)" }}>
                    {p.name}
                  </Link>
                  {p.primaryDomain && (
                    <span className="text-[9px] shrink-0" style={{ color: "var(--foreground-dim)" }}>{p.primaryDomain}</span>
                  )}
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ background: `${stg.color}15`, color: stg.color }}>
                    S{p.engagementStage}
                  </span>
                  <StageAdvanceButton projectId={p.id} currentStage={p.engagementStage} isUnassigned cseUsers={cseUsers} />
                </div>
              );
            })}
            {unassignedProjects.length > 6 && (
              <p className="text-[10px] text-center pt-1" style={{ color: "var(--foreground-dim)" }}>
                +{unassignedProjects.length - 6} more unassigned
              </p>
            )}
          </div>
        </div>
      )}

      {/* Fleet Command Map */}
      <div className="mb-8">
        <FleetCommandMapWrapper fleet={fleetViz} admiralName="Jared" stats={fleetStats} />
      </div>

      {/* Workload Heatmap (Point 17) */}
      <WorkloadHeatmap fleet={fleet} />

      {/* Cascade Health (Point 18) */}
      <CascadeHealthCard cascadeHealth={cascadeHealth} />

      {/* XP Leaderboard */}
      <div id="xp-leaderboard" className="mb-8">
        <XpLeaderboard
          leaderboard={xpLeaderboard.map((e) => ({
            ...e,
            levelInfo: { ...e.levelInfo },
          }))}
          recentEvents={xpRecentEvents.map((e) => ({
            ...e,
            createdAt: e.createdAt.toISOString(),
          }))}
          totalTeamXp={totalTeamXp}
        />
      </div>

      {/* CSE Fleet Cards */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>CSE Fleet</h2>
          <Link href="/admiral/users" className="text-sm" style={{ color: "var(--accent-cyan)" }}>
            Manage Roster →
          </Link>
        </div>

        {fleet.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No CSEs in the fleet yet</p>
            <Link href="/admiral/users" className="btn-primary text-sm mt-3 inline-block">Add CSE</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {fleet.map((cse) => (
              <div
                key={cse.id}
                className="card-glow p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/admiral/cse/${cse.id}`} className="font-semibold text-sm hover:underline" style={{ color: "var(--foreground)" }}>{cse.name}</Link>
                    <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{cse.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admiral/cse/${cse.id}`}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                      style={{ background: "rgba(201,162,39,0.08)", color: "#c9a227", border: "1px solid rgba(201,162,39,0.15)" }}>
                      Manage
                    </Link>
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e" }}
                    >
                      CSE
                    </span>
                  </div>
                </div>

                {/* Workload Bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span style={{ color: "var(--foreground-dim)" }}>Project Load</span>
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>
                      {cse._count.projects} engagement{cse._count.projects !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (cse._count.projects / Math.max(totalLoad / fleet.length * 2, 1)) * 100)}%`,
                        background: cse._count.projects > 4
                          ? "linear-gradient(90deg, #ef4444, #f97316)"
                          : cse._count.projects > 2
                            ? "linear-gradient(90deg, #f59e0b, #eab308)"
                            : "linear-gradient(90deg, #22c55e, #16a34a)",
                      }}
                    />
                  </div>
                </div>

                {/* Mini Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="py-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--accent-cyan)" }}>{cse.totalPhases}</p>
                    <p className="text-[9px] uppercase" style={{ color: "var(--foreground-dim)" }}>Phases</p>
                  </div>
                  <div className="py-1.5 rounded" style={{ background: cse.activeBlockers > 0 ? "rgba(239, 68, 68, 0.05)" : "rgba(255,255,255,0.02)" }}>
                    <p className="text-sm font-bold" style={{ color: cse.activeBlockers > 0 ? "#ef4444" : "var(--foreground-dim)" }}>{cse.activeBlockers}</p>
                    <p className="text-[9px] uppercase" style={{ color: "var(--foreground-dim)" }}>Blockers</p>
                  </div>
                  <div className="py-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{cse._count.ingestRuns}</p>
                    <p className="text-[9px] uppercase" style={{ color: "var(--foreground-dim)" }}>Ingests</p>
                  </div>
                </div>

                {/* Project List */}
                {cse.projects.length > 0 && (
                  <div className="space-y-1">
                    {cse.projects.slice(0, 4).map((p) => {
                      const stg = ENGAGEMENT_STAGES[p.engagementStage] ?? ENGAGEMENT_STAGES[0];
                      return (
                        <div key={p.id} className="flex items-center gap-1 py-1.5 px-2 rounded text-xs transition-colors hover:bg-white/5">
                          <Link
                            href={`/projects/${p.id}`}
                            className="flex-1 truncate"
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {p.name}
                          </Link>
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
                            style={{ background: `${stg.color}15`, color: stg.color }}>
                            S{p.engagementStage}
                          </span>
                          <StageAdvanceButton projectId={p.id} currentStage={p.engagementStage} cseUsers={cseUsers} />
                        </div>
                      );
                    })}
                    {cse.projects.length > 4 && (
                      <p className="text-[10px] text-center" style={{ color: "var(--foreground-dim)" }}>
                        +{cse.projects.length - 4} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks & Notes Command Center */}
      <DashboardQuickPanels recentTasks={recentTasks} recentNotes={recentNotes} />

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {[
          { href: "/admiral/tasks", label: "Tasks", color: "#3b82f6" },
          { href: "/admiral/notes", label: "Notes", color: "#c9a227" },
          { href: "/admiral/users", label: "CSE Roster", color: "#22c55e" },
          { href: "/admiral/projects", label: "Engagements", color: "#06d6d6" },
          { href: "/admiral/blockers", label: "Blockers", color: "#ef4444" },
          { href: "/dashboard", label: "CSE View", color: "#8b5cf6" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="text-xs text-center py-2.5 px-2 rounded-lg transition-all hover:scale-[1.02]"
            style={{
              background: `${a.color}10`,
              color: a.color,
              border: `1px solid ${a.color}20`,
            }}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Credentials Reference */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>Fleet Credentials</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "#c9a227" }}>Admiral</p>
            <p className="text-sm font-mono" style={{ color: "var(--foreground)" }}>jared@postman.com / admiral123</p>
          </div>
          {["daniel", "hammad", "pavan", "sean", "andrew"].map((name) => (
            <div key={name} className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "#22c55e" }}>CSE</p>
              <p className="text-sm font-mono" style={{ color: "var(--foreground)" }}>{name}@postman.com / pipeline123</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function EngagementStagePipeline({ fleet }: { fleet: any[] }) {
  const allProjects = fleet.flatMap((c: any) => c.projects ?? []);
  const stageCounts = ENGAGEMENT_STAGES.map((s) => ({
    ...s,
    count: allProjects.filter((p: any) => (p.engagementStage ?? 0) === s.stage).length,
  }));
  const maxCount = Math.max(1, ...stageCounts.map((s) => s.count));

  return (
    <div className="mb-8 card-glow p-5">
      <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Engagement Lifecycle Pipeline
      </h2>
      <div className="flex items-end gap-2">
        {stageCounts.map((s) => (
          <div key={s.stage} className="flex-1 flex flex-col items-center gap-1.5 group">
            <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>
              {s.count}
            </span>
            <div className="w-full relative" style={{ height: 60 }}>
              <div
                className="absolute bottom-0 w-full rounded-t transition-all group-hover:brightness-125"
                style={{
                  height: `${Math.max(4, (s.count / maxCount) * 100)}%`,
                  background: `linear-gradient(to top, ${s.color}40, ${s.color})`,
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold" style={{ color: s.color }}>S{s.stage}</p>
              <p className="text-[8px] leading-tight" style={{ color: "var(--foreground-dim)" }}>{s.shortName}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[9px]" style={{ color: "var(--foreground-dim)" }}>
        <span>← Allocated</span>
        <span className="flex items-center gap-1">
          {ENGAGEMENT_STAGES.map((s, i) => (
            <span key={s.stage}>
              {i > 0 && <span className="mx-0.5">→</span>}
              <span style={{ color: s.color }}>{s.shortName}</span>
            </span>
          ))}
        </span>
        <span>Handoff →</span>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const CSE_CAPACITY = 5;

function WorkloadHeatmap({ fleet }: { fleet: any[] }) {
  return (
    <div className="mb-8 card-glow p-5">
      <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        CSE Workload Heatmap
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {fleet.map((cse: any) => {
          const count = cse._count.projects;
          const pct = count / CSE_CAPACITY;
          const color = pct > 0.8 ? "#ef4444" : pct > 0.6 ? "#f59e0b" : "#22c55e";
          const bgAlpha = pct > 0.8 ? "0.12" : pct > 0.6 ? "0.10" : "0.08";
          return (
            <div
              key={cse.id}
              className="rounded-lg p-3 text-center transition-all"
              style={{
                background: `rgba(${pct > 0.8 ? "239,68,68" : pct > 0.6 ? "245,158,11" : "34,197,94"}, ${bgAlpha})`,
                border: `1px solid ${color}30`,
              }}
            >
              <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{cse.name}</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{count}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                / {CSE_CAPACITY} capacity
              </p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, pct * 100)}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] mt-3" style={{ color: "var(--foreground-dim)" }}>
        Capacity: {CSE_CAPACITY} engagements per CSE &middot;
        <span style={{ color: "#22c55e" }}> ■</span> &lt;60%
        <span style={{ color: "#f59e0b" }}> ■</span> 60–80%
        <span style={{ color: "#ef4444" }}> ■</span> &gt;80%
      </p>
    </div>
  );
}

interface CascadeEntry {
  projectId: string;
  projectName: string;
  clean: number;
  dirty: number;
  stale: number;
  other: number;
  lastCascadeRun: Date | null;
}

function CascadeHealthCard({ cascadeHealth }: { cascadeHealth: CascadeEntry[] }) {
  if (cascadeHealth.length === 0) return null;

  return (
    <div className="mb-8 card-glow p-5">
      <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Cascade Health
      </h2>
      <div className="space-y-2">
        {cascadeHealth.map((entry) => {
          const total = entry.clean + entry.dirty + entry.stale + entry.other;
          const cleanPct = total > 0 ? (entry.clean / total) * 100 : 0;
          const dirtyPct = total > 0 ? (entry.dirty / total) * 100 : 0;
          const stalePct = total > 0 ? (entry.stale / total) * 100 : 0;
          return (
            <div key={entry.projectId} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
              <Link
                href={`/projects/${entry.projectId}`}
                className="text-xs font-medium truncate w-40 shrink-0 hover:underline"
                style={{ color: "var(--foreground-muted)" }}
              >
                {entry.projectName}
              </Link>
              <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.05)" }}>
                {cleanPct > 0 && <div className="h-full" style={{ width: `${cleanPct}%`, background: "#22c55e" }} />}
                {dirtyPct > 0 && <div className="h-full" style={{ width: `${dirtyPct}%`, background: "#f59e0b" }} />}
                {stalePct > 0 && <div className="h-full" style={{ width: `${stalePct}%`, background: "#ef4444" }} />}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px]">
                <span style={{ color: "#22c55e" }}>{entry.clean}C</span>
                <span style={{ color: "#f59e0b" }}>{entry.dirty}D</span>
                <span style={{ color: "#ef4444" }}>{entry.stale}S</span>
              </div>
              <span className="text-[9px] shrink-0 w-20 text-right" style={{ color: "var(--foreground-dim)" }}>
                {entry.lastCascadeRun ? new Date(entry.lastCascadeRun).toLocaleDateString() : "Never"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] mt-3" style={{ color: "var(--foreground-dim)" }}>
        <span style={{ color: "#22c55e" }}>C</span> = Clean &middot;
        <span style={{ color: "#f59e0b" }}> D</span> = Dirty &middot;
        <span style={{ color: "#ef4444" }}> S</span> = Stale
      </p>
    </div>
  );
}
