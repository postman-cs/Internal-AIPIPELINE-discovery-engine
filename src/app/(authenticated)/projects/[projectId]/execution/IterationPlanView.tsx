"use client";

import { useState } from "react";

interface BacklogItem {
  id?: string;
  title?: string;
  type?: string;
  priority?: string;
  description?: string;
  targetComponentIds?: string[];
  triggerSource?: string;
  expectedOutcome?: string;
  estimatedEffort?: string;
  evidenceIds?: string[];
  confidence?: string;
}

interface DriftArea {
  area?: string;
  description?: string;
  severity?: string;
}

interface IterationData {
  backlogItems?: BacklogItem[];
  priorityMatrix?: {
    criticalPath?: string[];
    quickWins?: string[];
    strategicInvestments?: string[];
    deferred?: string[];
  };
  driftAnalysis?: {
    driftDetected?: boolean;
    driftAreas?: DriftArea[];
  };
  nextCycleRecommendation?: string;
}

export function IterationPlanView({ data }: { data: IterationData }) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [matrixView, setMatrixView] = useState(true);

  const items = data.backlogItems ?? [];
  const matrix = data.priorityMatrix ?? {};
  const drift = data.driftAnalysis ?? {};
  const nextCycle = data.nextCycleRecommendation ?? "";

  const criticalPath = matrix.criticalPath ?? [];
  const quickWins = matrix.quickWins ?? [];
  const strategic = matrix.strategicInvestments ?? [];
  const deferred = matrix.deferred ?? [];
  const hasMatrix = criticalPath.length + quickWins.length + strategic.length + deferred.length > 0;

  const priorityColors: Record<string, string> = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#3b82f6",
    low: "#10b981",
  };

  const typeIcons: Record<string, string> = {
    feature: "F",
    improvement: "I",
    optimization: "O",
    fix: "X",
    migration: "M",
    integration: "G",
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Backlog Items" value={items.length} color="#34d399" />
        <StatCard label="Critical Path" value={criticalPath.length} color="#ef4444" />
        <StatCard label="Quick Wins" value={quickWins.length} color="#10b981" />
        <StatCard
          label="Drift Detected"
          value={drift.driftDetected ? (drift.driftAreas?.length ?? 0) : 0}
          color={drift.driftDetected ? "#f59e0b" : "#10b981"}
          isBoolean
          booleanValue={drift.driftDetected ?? false}
        />
      </div>

      {/* Drift Analysis Warning */}
      {drift.driftDetected && (drift.driftAreas?.length ?? 0) > 0 && (
        <section>
          <div
            className="rounded-lg p-4 relative overflow-hidden"
            style={{
              background: "rgba(245,158,11,0.03)",
              border: "1px solid rgba(245,158,11,0.15)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, rgba(245,158,11,0.6), rgba(245,158,11,0.1), transparent)" }}
            />
            <div className="flex items-center gap-2 mb-3">
              <DriftIcon />
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#fbbf24" }}>
                Drift Analysis
              </h3>
              <span
                className="text-[9px] px-2 py-0.5 rounded-full font-bold animate-pulse-glow"
                style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
              >
                {drift.driftAreas!.length} AREA{drift.driftAreas!.length > 1 ? "S" : ""} DETECTED
              </span>
            </div>
            <div className="space-y-2">
              {drift.driftAreas!.map((area, i) => {
                const severity = (area.severity ?? "medium").toLowerCase();
                const color = severity === "high" || severity === "critical" ? "#ef4444" : severity === "medium" ? "#f59e0b" : "#3b82f6";
                return (
                  <div
                    key={i}
                    className="rounded-md px-3 py-2 flex items-start gap-2"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ background: color, boxShadow: `0 0 6px ${color}50` }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                          {area.area || `Area ${i + 1}`}
                        </span>
                        <span
                          className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase"
                          style={{ background: `${color}12`, color }}
                        >
                          {severity}
                        </span>
                      </div>
                      {area.description && (
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                          {area.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Priority Matrix */}
      {hasMatrix && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeader icon={<MatrixIcon />} title="Priority Matrix" color="#8b5cf6" />
            <button
              onClick={() => setMatrixView(!matrixView)}
              className="text-[10px] px-2 py-1 rounded transition-colors"
              style={{ background: "var(--surface)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}
            >
              {matrixView ? "List View" : "Matrix View"}
            </button>
          </div>
          {matrixView ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MatrixQuadrant
                title="Critical Path"
                items={criticalPath}
                color="#ef4444"
                icon="⚡"
                description="Must complete for success"
              />
              <MatrixQuadrant
                title="Quick Wins"
                items={quickWins}
                color="#10b981"
                icon="✦"
                description="High impact, low effort"
              />
              <MatrixQuadrant
                title="Strategic Investments"
                items={strategic}
                color="#3b82f6"
                icon="◆"
                description="Long-term value plays"
              />
              <MatrixQuadrant
                title="Deferred"
                items={deferred}
                color="var(--foreground-dim)"
                icon="◇"
                description="Low priority, revisit later"
              />
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              {[
                ...criticalPath.map(i => ({ item: i, bucket: "Critical", color: "#ef4444" })),
                ...quickWins.map(i => ({ item: i, bucket: "Quick Win", color: "#10b981" })),
                ...strategic.map(i => ({ item: i, bucket: "Strategic", color: "#3b82f6" })),
                ...deferred.map(i => ({ item: i, bucket: "Deferred", color: "var(--foreground-dim)" })),
              ].map((entry, i) => (
                <div
                  key={i}
                  className="rounded-md px-3 py-1.5 flex items-center gap-2"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                    style={{ background: `${entry.color}12`, color: entry.color }}
                  >
                    {entry.bucket}
                  </span>
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{entry.item}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Backlog Items */}
      {items.length > 0 && (
        <section>
          <SectionHeader icon={<BacklogIcon />} title="Iteration Backlog" color="#34d399" />
          <div className="mt-3 space-y-2">
            {items.map((item, i) => {
              const isExpanded = expandedItem === i;
              const priority = (item.priority ?? "medium").toLowerCase();
              const pColor = priorityColors[priority] ?? "#3b82f6";
              const typeKey = (item.type ?? "").toLowerCase();
              const typeIcon = typeIcons[typeKey] ?? "•";

              return (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden transition-all duration-200"
                  style={{
                    background: isExpanded ? "rgba(52,211,153,0.02)" : "var(--surface)",
                    border: isExpanded ? "1px solid rgba(52,211,153,0.15)" : "1px solid var(--border)",
                    borderLeft: `3px solid ${pColor}`,
                  }}
                >
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : i)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-3"
                  >
                    {/* Type icon */}
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: `${pColor}10`, color: pColor, border: `1px solid ${pColor}20` }}
                    >
                      {typeIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                          {item.title || `Item ${i + 1}`}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase shrink-0"
                          style={{ background: `${pColor}10`, color: pColor, border: `1px solid ${pColor}18` }}
                        >
                          {priority}
                        </span>
                        {item.type && (
                          <span className="text-[9px] px-1 py-0.5 rounded shrink-0" style={{ background: "rgba(139,92,246,0.06)", color: "#a78bfa" }}>
                            {item.type}
                          </span>
                        )}
                      </div>
                      {!isExpanded && item.description && (
                        <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--foreground-dim)" }}>
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.estimatedEffort && (
                        <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                          {item.estimatedEffort}
                        </span>
                      )}
                      {item.confidence && <ConfidenceDot confidence={item.confidence} />}
                      <ChevronIcon open={isExpanded} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 animate-in">
                      {item.description && (
                        <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                          {item.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        {item.triggerSource && (
                          <DetailBlock label="Trigger Source">
                            <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{item.triggerSource}</span>
                          </DetailBlock>
                        )}
                        {item.expectedOutcome && (
                          <DetailBlock label="Expected Outcome">
                            <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{item.expectedOutcome}</span>
                          </DetailBlock>
                        )}
                      </div>
                      {(item.targetComponentIds?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.targetComponentIds!.map((c, j) => (
                            <span
                              key={j}
                              className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(6,214,214,0.06)", color: "#06d6d6", border: "1px solid rgba(6,214,214,0.1)" }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Next Cycle Recommendation */}
      {nextCycle && (
        <section>
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={{
              background: "rgba(52,211,153,0.03)",
              border: "1px solid rgba(52,211,153,0.15)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: "linear-gradient(to right, rgba(52,211,153,0.5), rgba(52,211,153,0.15), transparent)" }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, rgba(52,211,153,0.4), transparent)" }}
            />
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.12)" }}
              >
                <CycleIcon />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#34d399" }}>
                Next Cycle Recommendation
              </h3>
            </div>
            <p className="text-sm leading-relaxed pl-12" style={{ color: "var(--foreground-muted)" }}>
              {nextCycle}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label, value, color, isBoolean, booleanValue,
}: {
  label: string; value: number; color: string; isBoolean?: boolean; booleanValue?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: `${color}08`, border: `1px solid ${color}15` }}
    >
      {isBoolean ? (
        <p className="text-xl font-bold" style={{ color }}>
          {booleanValue ? `${value}` : "None"}
        </p>
      ) : (
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      )}
      <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: `${color}12`, color }}
      >
        {icon}
      </div>
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{title}</h3>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${color}30, transparent)` }} />
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--foreground-dim)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function MatrixQuadrant({
  title, items, color, icon, description,
}: {
  title: string; items: string[]; color: string; icon: string; description: string;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: items.length > 0 ? `${color}04` : "var(--surface)",
        border: items.length > 0 ? `1px solid ${color}15` : "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-semibold" style={{ color }}>{title}</span>
        <span className="text-[10px] font-bold ml-auto" style={{ color }}>{items.length}</span>
      </div>
      <p className="text-[9px] mb-2" style={{ color: "var(--foreground-dim)" }}>{description}</p>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded px-2 py-1.5 text-[10px]"
              style={{
                background: "var(--surface)",
                color: "var(--foreground-muted)",
                borderLeft: `2px solid ${color}`,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] italic" style={{ color: "var(--foreground-dim)" }}>No items</p>
      )}
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  const lower = confidence.toLowerCase();
  const color = lower === "high" ? "#10b981" : lower === "medium" ? "#f59e0b" : "#ef4444";
  return (
    <div
      className="w-2 h-2 rounded-full"
      title={`Confidence: ${confidence}`}
      style={{ background: color, boxShadow: `0 0 4px ${color}50` }}
    />
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      style={{ color: "var(--foreground-dim)" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// SVG Icons
function DriftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function MatrixIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function BacklogIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function CycleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
    </svg>
  );
}
