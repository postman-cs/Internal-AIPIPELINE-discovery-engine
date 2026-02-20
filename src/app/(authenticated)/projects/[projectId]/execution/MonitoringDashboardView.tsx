"use client";

import { useState } from "react";

interface Monitor {
  id?: string;
  name?: string;
  type?: string;
  targetComponentId?: string;
  description?: string;
  threshold?: string;
  frequency?: string;
  evidenceIds?: string[];
  confidence?: string;
}

interface PostmanMonitor {
  name?: string;
  collectionRef?: string;
  environmentRef?: string;
  schedule?: string;
  regions?: string[];
  alertChannels?: string[];
  targetComponentId?: string;
}

interface SLO {
  name?: string;
  targetComponentId?: string;
  metric?: string;
  target?: string;
  window?: string;
}

interface AlertRule {
  name?: string;
  condition?: string;
  severity?: string;
  action?: string;
  targetComponentId?: string;
}

interface DashboardPanel {
  title?: string;
  metricQuery?: string;
  visualizationType?: string;
}

interface RenewalSignal {
  signal?: string;
  indicator?: string;
  description?: string;
}

interface MonitoringData {
  monitors?: Monitor[];
  postmanMonitors?: PostmanMonitor[];
  sloDefinitions?: SLO[];
  alertRules?: AlertRule[];
  dashboardSpec?: { panels?: DashboardPanel[] };
  renewalSignals?: RenewalSignal[];
}

export function MonitoringDashboardView({ data }: { data: MonitoringData }) {
  const [activeMonitor, setActiveMonitor] = useState<number | null>(null);

  const monitors = data.monitors ?? [];
  const postmanMonitors = data.postmanMonitors ?? [];
  const slos = data.sloDefinitions ?? [];
  const alerts = data.alertRules ?? [];
  const panels = data.dashboardSpec?.panels ?? [];
  const signals = data.renewalSignals ?? [];

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-5 gap-3">
        <MetricCard label="Monitors" value={monitors.length} color="#06d6d6" icon={<PulseIcon />} />
        <MetricCard label="Postman Monitors" value={postmanMonitors.length} color="#22c55e" icon={<PostmanIcon />} />
        <MetricCard label="SLOs" value={slos.length} color="#8b5cf6" icon={<TargetIcon />} />
        <MetricCard label="Alert Rules" value={alerts.length} color="#ef4444" icon={<BellIcon />} />
        <MetricCard label="Renewal Signals" value={signals.length} color="#10b981" icon={<SignalIcon />} />
      </div>

      {/* Monitors Grid */}
      {monitors.length > 0 && (
        <section>
          <SectionHeader icon={<PulseIcon />} title="Active Monitors" color="#06d6d6" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {monitors.map((mon, i) => (
              <button
                key={i}
                onClick={() => setActiveMonitor(activeMonitor === i ? null : i)}
                className="rounded-lg p-3 text-left transition-all duration-200 group relative overflow-hidden"
                style={{
                  background: activeMonitor === i ? "rgba(6,214,214,0.04)" : "var(--surface)",
                  border: activeMonitor === i
                    ? "1px solid rgba(6,214,214,0.2)"
                    : "1px solid var(--border)",
                }}
              >
                {/* Subtle animated pulse for active state */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "radial-gradient(circle at 50% 0%, rgba(6,214,214,0.04), transparent 70%)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: "#06d6d6",
                          boxShadow: "0 0 6px rgba(6,214,214,0.5)",
                        }}
                      />
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                        {mon.name || `Monitor ${i + 1}`}
                      </span>
                    </div>
                    <ConfidenceBadge confidence={mon.confidence ?? "Medium"} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {mon.type && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                        style={{ background: "rgba(6,214,214,0.08)", color: "#06d6d6" }}
                      >
                        {mon.type.replace(/_/g, " ")}
                      </span>
                    )}
                    {mon.frequency && (
                      <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                        Every {mon.frequency}
                      </span>
                    )}
                  </div>
                  {mon.description && (
                    <p
                      className={`text-[11px] leading-relaxed ${activeMonitor === i ? "" : "line-clamp-2"}`}
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      {mon.description}
                    </p>
                  )}
                  {activeMonitor === i && mon.threshold && (
                    <div
                      className="mt-2 rounded px-2 py-1.5"
                      style={{ background: "rgba(6,214,214,0.04)", border: "1px solid rgba(6,214,214,0.1)" }}
                    >
                      <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--foreground-dim)" }}>
                        Threshold
                      </span>
                      <p className="text-[11px]" style={{ color: "#06d6d6" }}>{mon.threshold}</p>
                    </div>
                  )}
                  {mon.targetComponentId && (
                    <span className="text-[9px] mt-2 inline-block" style={{ color: "var(--foreground-dim)" }}>
                      Target: {mon.targetComponentId}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Postman Monitors */}
      {postmanMonitors.length > 0 && (
        <section>
          <SectionHeader icon={<PostmanIcon />} title="Postman Monitors" color="#22c55e" />
          <div className="mt-3 space-y-2">
            {postmanMonitors.map((pm, i) => (
              <div
                key={i}
                className="rounded-lg p-3 relative overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(to right, rgba(34,197,94,0.4), transparent)" }}
                />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: "rgba(34,197,94,0.1)" }}
                    >
                      <PostmanIcon />
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {pm.name || `Monitor ${i + 1}`}
                    </span>
                  </div>
                  {pm.schedule && (
                    <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                      {pm.schedule}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {pm.collectionRef && (
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.06)", color: "#22c55e" }}>
                      Collection: {pm.collectionRef}
                    </span>
                  )}
                  {pm.environmentRef && (
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.06)", color: "#a78bfa" }}>
                      Env: {pm.environmentRef}
                    </span>
                  )}
                  {(pm.regions ?? []).map((r, j) => (
                    <span key={j} className="px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.06)", color: "#60a5fa" }}>
                      {r}
                    </span>
                  ))}
                </div>
                {(pm.alertChannels?.length ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    <BellIcon small />
                    <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                      Alerts: {pm.alertChannels!.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SLO Definitions */}
      {slos.length > 0 && (
        <section>
          <SectionHeader icon={<TargetIcon />} title="Service Level Objectives" color="#8b5cf6" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {slos.map((slo, i) => (
              <div
                key={i}
                className="rounded-lg p-3 relative"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                    {slo.name || `SLO ${i + 1}`}
                  </span>
                  {slo.window && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.06)", color: "#a78bfa" }}>
                      {slo.window}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* SLO gauge visualization */}
                  <div className="relative w-12 h-12 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-12 h-12">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(139,92,246,0.1)"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        strokeDasharray={`${parseTargetPercent(slo.target ?? "")}, 100`}
                        strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 3px rgba(139,92,246,0.3))" }}
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                      style={{ color: "#a78bfa" }}
                    >
                      {slo.target || "—"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {slo.metric && (
                      <p className="text-[11px] mb-0.5" style={{ color: "var(--foreground-muted)" }}>
                        Metric: {slo.metric}
                      </p>
                    )}
                    {slo.targetComponentId && (
                      <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                        Component: {slo.targetComponentId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alert Rules */}
      {alerts.length > 0 && (
        <section>
          <SectionHeader icon={<BellIcon />} title="Alert Rules" color="#ef4444" />
          <div className="mt-3 space-y-2">
            {alerts.map((alert, i) => {
              const severity = (alert.severity ?? "medium").toLowerCase();
              const severityColor = severity === "critical" ? "#ef4444" : severity === "high" ? "#f59e0b" : severity === "medium" ? "#3b82f6" : "#10b981";
              return (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-1 h-8 rounded-full shrink-0"
                    style={{ background: severityColor, boxShadow: `0 0 6px ${severityColor}40` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                        {alert.name || `Rule ${i + 1}`}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase"
                        style={{ background: `${severityColor}12`, color: severityColor, border: `1px solid ${severityColor}20` }}
                      >
                        {severity}
                      </span>
                    </div>
                    {alert.condition && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                        When: {alert.condition}
                      </p>
                    )}
                  </div>
                  {alert.action && (
                    <span className="text-[10px] shrink-0" style={{ color: "var(--foreground-muted)" }}>
                      Action: {alert.action}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dashboard Panels Preview */}
      {panels.length > 0 && (
        <section>
          <SectionHeader icon={<ChartIcon />} title="Dashboard Layout" color="#3b82f6" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {panels.map((panel, i) => (
              <div
                key={i}
                className="rounded-lg p-3 flex flex-col"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 80 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>
                    {panel.title || `Panel ${i + 1}`}
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.06)", color: "#60a5fa" }}>
                    {panel.visualizationType || "line"}
                  </span>
                </div>
                {/* Mini chart visualization */}
                <div className="flex-1 flex items-end justify-center gap-0.5 opacity-50">
                  <PanelViz type={panel.visualizationType ?? "line"} />
                </div>
                {panel.metricQuery && (
                  <p className="text-[9px] mt-1 truncate" style={{ color: "var(--foreground-dim)" }}>
                    {panel.metricQuery}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Renewal Signals */}
      {signals.length > 0 && (
        <section>
          <SectionHeader icon={<SignalIcon />} title="Renewal Signals" color="#10b981" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {signals.map((sig, i) => {
              const indicator = (sig.indicator ?? "Neutral").toLowerCase();
              const color = indicator === "positive" || indicator === "strong" ? "#10b981"
                : indicator === "negative" || indicator === "weak" ? "#ef4444"
                : "#f59e0b";
              return (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2 flex items-start gap-2"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ background: color, boxShadow: `0 0 6px ${color}50` }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                        {sig.signal || `Signal ${i + 1}`}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}
                      >
                        {sig.indicator || "Neutral"}
                      </span>
                    </div>
                    {sig.description && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                        {sig.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  if (value === 0) return <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: 0.4 }}>
    <p className="text-lg font-bold" style={{ color: "var(--foreground-dim)" }}>0</p>
    <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
  </div>;
  return (
    <div
      className="rounded-lg p-3 relative overflow-hidden"
      style={{ background: `${color}06`, border: `1px solid ${color}15` }}
    >
      <div className="absolute top-0 right-0 opacity-10 -mr-1 -mt-1" style={{ color }}>{icon}</div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ color }}>{icon}</div>
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{title}</h3>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${color}30, transparent)` }} />
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const lower = confidence.toLowerCase();
  const color = lower === "high" ? "#10b981" : lower === "medium" ? "#f59e0b" : "#ef4444";
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: `${color}10`, color, border: `1px solid ${color}18` }}
    >
      {confidence}
    </span>
  );
}

function PanelViz({ type }: { type: string }) {
  if (type === "bar" || type === "histogram") {
    return (
      <>
        {[40, 60, 35, 75, 55, 45, 70].map((h, i) => (
          <div key={i} className="w-2 rounded-t" style={{ height: `${h}%`, background: "rgba(59,130,246,0.3)" }} />
        ))}
      </>
    );
  }
  if (type === "gauge") {
    return (
      <svg viewBox="0 0 36 20" className="w-10 h-6">
        <path d="M4 18 A14 14 0 0 1 32 18" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="3" />
        <path d="M4 18 A14 14 0 0 1 26 6" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // Default: line chart
  return (
    <svg viewBox="0 0 60 24" className="w-full h-6">
      <polyline
        points="0,20 8,16 16,18 24,10 32,14 40,6 48,10 60,4"
        fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5"
      />
      <polyline
        points="0,20 8,16 16,18 24,10 32,14 40,6 48,10 60,4"
        fill="url(#lineGrad)" stroke="none"
      />
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.15)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function parseTargetPercent(target: string): number {
  const num = parseFloat(target.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 75;
  return Math.min(num, 100);
}

// SVG Icons
function PulseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function PostmanIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#22c55e" }}>
      <path d="M13.527.099C6.955-.744.942 3.9.099 10.473c-.843 6.572 3.8 12.584 10.373 13.428 6.573.843 12.587-3.801 13.428-10.374C24.744 6.955 20.101.943 13.527.099zm2.471 7.485a.855.855 0 011.209 0c.335.335.335.877 0 1.21l-4.5 4.5a.855.855 0 01-1.21 0l-2-2a.855.855 0 010-1.21.855.855 0 011.21 0l1.395 1.395 3.896-3.895z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a5 5 0 100-10 5 5 0 000 10z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 13a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  );
}

function BellIcon({ small }: { small?: boolean }) {
  return (
    <svg className={small ? "w-3 h-3" : "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-2.77a3 3 0 014.24 0L12 14.25l2.77-2.77a3 3 0 014.24 0L21 13.5M3 15l2.77-2.77a3 3 0 014.24 0L12 14.25l2.77-2.77a3 3 0 014.24 0L21 13.5m0 0V21m0-6.75V3" />
    </svg>
  );
}
