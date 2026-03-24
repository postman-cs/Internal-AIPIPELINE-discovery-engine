"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Champion {
  name: string;
  team: string;
  role: string;
  status: string;
  focus: string;
}

interface EnablementProgram {
  name: string;
  format: string;
  duration: string;
  audience: string;
  completionTarget: string;
}

interface AdoptionWave {
  wave: number;
  teams: string[];
  status: string;
  startWeek: number;
  endWeek: number;
  milestone: string;
}

interface SuccessMetric {
  metric: string;
  current: string;
  target: string;
  measurement: string;
}

interface RiskItem {
  risk: string;
  mitigation: string;
}

interface AdoptionStrategy {
  vision: string;
  targetAdoptionRate: string;
  timeline: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TabId = "overview" | "champions" | "enablement" | "waves" | "metrics" | "executive";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📋" },
  { id: "champions", label: "Champions", icon: "🏆" },
  { id: "enablement", label: "Enablement", icon: "🎓" },
  { id: "waves", label: "Adoption Waves", icon: "🌊" },
  { id: "metrics", label: "Success Metrics", icon: "📊" },
  { id: "executive", label: "Executive Brief", icon: "💼" },
];

export function AdoptionPanel({
  projectName,
  adoptionContent,
  adoptionMarkdown,
  iterationMetrics,
  hasArtifact,
  version,
  status,
}: {
  projectName: string;
  adoptionContent: Record<string, unknown> | null;
  adoptionMarkdown: string | null;
  iterationMetrics: Record<string, unknown> | null;
  hasArtifact: boolean;
  version: number;
  status: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const strategy = adoptionContent?.adoptionStrategy as AdoptionStrategy | undefined;
  const champions = (adoptionContent?.championNetwork ?? []) as Champion[];
  const enablement = (adoptionContent?.enablementProgram ?? []) as EnablementProgram[];
  const waves = (adoptionContent?.adoptionWaves ?? []) as AdoptionWave[];
  const metrics = (adoptionContent?.successMetrics ?? []) as SuccessMetric[];
  const talkingPoints = (adoptionContent?.executiveTalkingPoints ?? []) as string[];
  const risks = (adoptionContent?.riskMitigation ?? []) as RiskItem[];

  if (!hasArtifact) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: "var(--background)" }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl" style={{ background: "rgba(6,214,214,0.08)", border: "1px solid rgba(6,214,214,0.2)" }}>
            👥
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>Adoption Plan Not Yet Generated</h2>
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            Complete the Iteration phase, then run a Cascade Update to generate the adoption strategy.
          </p>
        </div>
      </div>
    );
  }

  const activeChampions = champions.filter((c) => c.status === "active").length;
  const completedWaves = waves.filter((w) => w.status === "complete").length;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ background: "var(--background-secondary)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
              Adoption Plan — {projectName}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-dim)" }}>
              {strategy?.vision ?? "Enterprise-wide adoption strategy"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-md"
              style={{
                background: status === "CLEAN" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                color: status === "CLEAN" ? "#34d399" : "#fbbf24",
                border: `1px solid ${status === "CLEAN" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)"}`,
              }}
            >
              {status} v{version}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-3">
          <QuickStat label="Champions" value={`${activeChampions} active`} color="#34d399" />
          <QuickStat label="Waves" value={`${completedWaves}/${waves.length} complete`} color="#60a5fa" />
          <QuickStat label="Enablement" value={`${enablement.length} programs`} color="#c084fc" />
          <QuickStat label="Metrics" value={`${metrics.length} tracked`} color="#fbbf24" />
          {iterationMetrics && (
            <QuickStat
              label="Teams"
              value={`${iterationMetrics.teamsOnboarded ?? 0}/${iterationMetrics.teamsTotal ?? 0}`}
              color="#f472b6"
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center px-4 shrink-0"
        style={{ background: "var(--background-secondary)", borderBottom: "1px solid var(--border)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-200"
            style={{
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent-cyan)" : "transparent"}`,
              color: activeTab === tab.id ? "var(--accent-cyan)" : "var(--foreground-dim)",
            }}
          >
            <span className="text-[10px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === "overview" && adoptionMarkdown && (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{adoptionMarkdown}</ReactMarkdown>
            </div>
          )}

          {activeTab === "champions" && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Champion Network</h2>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                Champions are the internal advocates who drive adoption within their teams. Each champion is responsible for onboarding, training, and evangelizing within their domain.
              </p>
              <div className="grid gap-3">
                {champions.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 flex items-start gap-4"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-bright)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: c.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                        color: c.status === "active" ? "#34d399" : "#fbbf24",
                        border: `1px solid ${c.status === "active" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
                      }}
                    >
                      {c.name === "TBD" ? "?" : c.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: c.status === "active" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                            color: c.status === "active" ? "#34d399" : "#fbbf24",
                          }}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        <span className="font-medium">{c.role}</span> &middot; {c.team}
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>{c.focus}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "enablement" && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Enablement Program</h2>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                Structured training programs to ensure every team member has the knowledge and skills to adopt the solution effectively.
              </p>
              <div className="space-y-3">
                {enablement.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-bright)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(192,132,252,0.1)", color: "#c084fc" }}>
                        {p.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--foreground-dim)" }}>
                      <span>Duration: <strong style={{ color: "var(--foreground-muted)" }}>{p.duration}</strong></span>
                      <span>Audience: <strong style={{ color: "var(--foreground-muted)" }}>{p.audience}</strong></span>
                      <span>Target: <strong style={{ color: "var(--foreground-muted)" }}>{p.completionTarget}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "waves" && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Adoption Waves</h2>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                Phased rollout strategy to minimize risk and build momentum through successive team adoptions.
              </p>

              {/* Timeline visualization */}
              <div className="space-y-3">
                {waves.map((w) => {
                  const statusColor = w.status === "complete" ? "#34d399" : w.status === "in_progress" ? "#60a5fa" : "var(--foreground-dim)";
                  const statusBg = w.status === "complete" ? "rgba(16,185,129,0.08)" : w.status === "in_progress" ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)";
                  return (
                    <div
                      key={w.wave}
                      className="rounded-xl p-4"
                      style={{ background: statusBg, border: `1px solid ${w.status === "complete" ? "rgba(16,185,129,0.15)" : w.status === "in_progress" ? "rgba(59,130,246,0.15)" : "var(--border)"}` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}30` }}
                          >
                            {w.wave}
                          </div>
                          <div>
                            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                              Wave {w.wave}
                            </span>
                            <span className="text-xs ml-2" style={{ color: "var(--foreground-dim)" }}>
                              Weeks {w.startWeek}–{w.endWeek}
                            </span>
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ background: `${statusColor}15`, color: statusColor }}
                        >
                          {w.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="ml-11">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {w.teams.map((t) => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{w.milestone}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "metrics" && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>Success Metrics</h2>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-bright)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--surface)" }}>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--foreground-muted)" }}>Metric</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--foreground-muted)" }}>Current</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--foreground-muted)" }}>Target</th>
                      <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "var(--foreground-muted)" }}>Measurement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{m.metric}</td>
                        <td className="px-4 py-3" style={{ color: "#fbbf24" }}>{m.current}</td>
                        <td className="px-4 py-3" style={{ color: "#34d399" }}>{m.target}</td>
                        <td className="px-4 py-3" style={{ color: "var(--foreground-dim)" }}>{m.measurement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Risk Mitigation */}
              {risks.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--foreground)" }}>Risk Mitigation</h3>
                  <div className="space-y-2">
                    {risks.map((r, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)" }}>
                        <div className="text-xs font-medium mb-1" style={{ color: "#f87171" }}>{r.risk}</div>
                        <div className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.mitigation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "executive" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold mb-3" style={{ color: "var(--foreground)" }}>Executive Talking Points</h2>
                <p className="text-xs mb-4" style={{ color: "var(--foreground-dim)" }}>
                  Key messages for executive stakeholders to reinforce the adoption initiative.
                </p>
                <div className="space-y-3">
                  {talkingPoints.map((tp, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg p-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border-bright)" }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ background: "rgba(6,214,214,0.1)", color: "var(--accent-cyan)", border: "1px solid rgba(6,214,214,0.2)" }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>{tp}</p>
                    </div>
                  ))}
                </div>
              </div>

              {strategy && (
                <div className="rounded-xl p-5" style={{ background: "rgba(6,214,214,0.04)", border: "1px solid rgba(6,214,214,0.1)" }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--accent-cyan)" }}>Adoption Strategy Summary</h3>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span style={{ color: "var(--foreground-dim)" }}>Target</span>
                      <p className="font-medium mt-0.5" style={{ color: "var(--foreground)" }}>{strategy.targetAdoptionRate}</p>
                    </div>
                    <div>
                      <span style={{ color: "var(--foreground-dim)" }}>Timeline</span>
                      <p className="font-medium mt-0.5" style={{ color: "var(--foreground)" }}>{strategy.timeline}</p>
                    </div>
                    <div>
                      <span style={{ color: "var(--foreground-dim)" }}>Approach</span>
                      <p className="font-medium mt-0.5" style={{ color: "var(--foreground)" }}>4-wave champion-led rollout</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{label}:</span>
      <span className="text-[10px] font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
