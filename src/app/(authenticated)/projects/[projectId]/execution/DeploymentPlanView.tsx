"use client";

import { useState } from "react";

interface DeploymentStep {
  phase?: string;
  title?: string;
  name?: string;
  description?: string;
  targetComponents?: string[];
  prerequisites?: string[];
  rollbackPlan?: string;
  estimatedDuration?: string;
  evidenceIds?: string[];
}

interface CiCdStage {
  stageName?: string;
  platform?: string;
  platformLabel?: string;
  configLanguage?: string;
  triggerCondition?: string;
  configSnippet?: string;
  gateChecks?: string[];
}

interface PromotionGate {
  fromEnv?: string;
  toEnv?: string;
  requiredChecks?: string[];
  approvalRequired?: boolean;
  newmanSuiteRef?: string;
}

interface TrainingReq {
  audience?: string;
  topic?: string;
  format?: string;
}

interface CommPlan {
  stakeholder?: string;
  message?: string;
  timing?: string;
}

interface DeploymentPlanData {
  deploymentSteps?: DeploymentStep[];
  changeManagementNotes?: string[];
  trainingRequirements?: TrainingReq[];
  communicationPlan?: CommPlan[];
  goLiveCriteria?: string[];
  overallTimeline?: string;
  ciCdStages?: CiCdStage[];
  environmentPromotionGates?: PromotionGate[];
  executedSteps?: number[];
}

interface DeploymentPlanViewProps {
  data: DeploymentPlanData;
  onExecuteStep?: (stepIndex: number, stepTitle: string) => void;
  executingStep?: number | null;
  executedSteps?: number[];
}

export function DeploymentPlanView({ data, onExecuteStep, executingStep, executedSteps: executedStepsProp }: DeploymentPlanViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showSnippet, setShowSnippet] = useState<number | null>(null);
  const executed = executedStepsProp ?? data.executedSteps ?? [];

  const steps = data.deploymentSteps ?? [];
  const stages = data.ciCdStages ?? [];
  const gates = data.environmentPromotionGates ?? [];
  const training = data.trainingRequirements ?? [];
  const comms = data.communicationPlan ?? [];
  const goLive = data.goLiveCriteria ?? [];
  const timeline = typeof data.overallTimeline === "string" ? data.overallTimeline : "";
  const changeNotes = data.changeManagementNotes ?? [];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Deploy Steps" value={steps.length} color="#22c55e" />
        <StatCard label="CI/CD Stages" value={stages.length} color="#8b5cf6" />
        <StatCard label="Env Gates" value={gates.length} color="#06d6d6" />
        <StatCard label="Go-Live Checks" value={goLive.length} color="#10b981" />
      </div>

      {timeline && (
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-3"
          style={{
            background: "rgba(34,197,94,0.04)",
            border: "1px solid rgba(34,197,94,0.12)",
          }}
        >
          <ClockIcon />
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--foreground-dim)" }}>
              Overall Timeline
            </span>
            <div className="text-sm space-y-0.5" style={{ color: "var(--foreground)" }}>
              {timeline.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Deployment Steps - Timeline */}
      {steps.length > 0 && (
        <section>
          <SectionHeader icon={<RocketIcon />} title="Deployment Pipeline" color="#22c55e" />
          <div className="relative ml-4 mt-3">
            <div
              className="absolute left-3 top-0 bottom-0 w-px"
              style={{ background: "linear-gradient(to bottom, rgba(34,197,94,0.4), rgba(34,197,94,0.05))" }}
            />
            {expandedStep !== null && (
              <div
                className="absolute left-[11px] w-[3px] rounded-full transition-all duration-500"
                style={{
                  top: `${expandedStep * 56}px`,
                  height: "56px",
                  background: "rgba(34,197,94,0.25)",
                  boxShadow: "0 0 8px rgba(34,197,94,0.3)",
                }}
              />
            )}
            <div className="space-y-1">
              {steps.map((step, i) => {
                const isExpanded = expandedStep === i;
                const isExecuted = executed.includes(i);
                const isExecuting = executingStep === i;
                const title = step.title || step.name || `Step ${i + 1}`;
                return (
                  <div key={i} className="relative pl-10">
                    {/* Node */}
                    <div
                      className="absolute left-0 top-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                      style={{
                        background: isExecuted ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.15)",
                        border: `2px solid ${isExecuted ? "rgba(34,197,94,0.8)" : "rgba(34,197,94,0.5)"}`,
                        color: "#22c55e",
                        boxShadow: isExpanded
                          ? "0 0 12px rgba(34,197,94,0.3)"
                          : isExecuted
                            ? "0 0 8px rgba(34,197,94,0.2)"
                            : "none",
                      }}
                    >
                      {isExecuted ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedStep(isExpanded ? null : i)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedStep(isExpanded ? null : i); } }}
                      className="w-full text-left rounded-lg p-3 transition-all duration-200 cursor-pointer"
                      style={{
                        background: isExpanded
                          ? "rgba(34,197,94,0.04)"
                          : isExecuted
                            ? "rgba(34,197,94,0.02)"
                            : "transparent",
                        border: isExpanded
                          ? "1px solid rgba(34,197,94,0.15)"
                          : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{
                              color: isExecuted ? "var(--foreground-muted)" : "var(--foreground)",
                              textDecorationLine: isExecuted ? "line-through" : "none",
                              textDecorationColor: isExecuted ? "rgba(34,197,94,0.3)" : undefined,
                            }}
                          >
                            {title}
                          </span>
                          {step.phase && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                              style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}
                            >
                              {step.phase}
                            </span>
                          )}
                          {isExecuted && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                            >
                              +25 XP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {step.estimatedDuration && (
                            <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                              {step.estimatedDuration}
                            </span>
                          )}
                          {onExecuteStep && !isExecuted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExecuteStep(i, title);
                              }}
                              disabled={isExecuting}
                              className="px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                              style={{
                                background: isExecuting
                                  ? "rgba(34,197,94,0.2)"
                                  : "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(6,214,214,0.15))",
                                color: "#22c55e",
                                border: "1px solid rgba(34,197,94,0.3)",
                                boxShadow: "0 0 10px rgba(34,197,94,0.08)",
                              }}
                            >
                              {isExecuting ? (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  Launching...
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                  </svg>
                                  Execute
                                </span>
                              )}
                            </button>
                          )}
                          <ChevronIcon open={isExpanded} />
                        </div>
                      </div>
                      {step.description && !isExpanded && (
                        <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--foreground-dim)" }}>
                          {step.description}
                        </p>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 animate-in">
                        {step.description && (
                          <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                            {step.description}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {(step.targetComponents?.length ?? 0) > 0 && (
                            <DetailBlock label="Target Components">
                              <div className="flex flex-wrap gap-1">
                                {step.targetComponents!.map((c, j) => (
                                  <span
                                    key={j}
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </DetailBlock>
                          )}
                          {(step.prerequisites?.length ?? 0) > 0 && (
                            <DetailBlock label="Prerequisites">
                              <div className="flex flex-wrap gap-1">
                                {step.prerequisites!.map((p, j) => (
                                  <span
                                    key={j}
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: "rgba(245,158,11,0.08)", color: "#fbbf24" }}
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </DetailBlock>
                          )}
                        </div>
                        {step.rollbackPlan && (
                          <div
                            className="rounded-md px-3 py-2 flex items-start gap-2"
                            style={{
                              background: "rgba(239,68,68,0.04)",
                              border: "1px solid rgba(239,68,68,0.1)",
                            }}
                          >
                            <span className="text-[10px] mt-0.5" style={{ color: "#f87171" }}>⟲</span>
                            <div>
                              <span className="text-[9px] uppercase tracking-wider font-semibold block mb-0.5" style={{ color: "#f87171" }}>
                                Rollback Plan
                              </span>
                              <span className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>
                                {step.rollbackPlan}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CI/CD Pipeline Stages */}
      {stages.length > 0 && (
        <section>
          <SectionHeader icon={<PipelineIcon />} title="CI/CD Pipeline Stages" color="#8b5cf6" />
          <div className="mt-3 relative">
            <div
              className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
            />
            <div className="overflow-x-auto pb-2 px-1">
            <div className="flex items-stretch gap-3 min-w-max">
              {stages.map((stage, i) => (
                <div key={i} className="flex items-stretch gap-3">
                  <button
                    onClick={() => setShowSnippet(showSnippet === i ? null : i)}
                    className="rounded-xl p-4 transition-all duration-200 text-left min-w-[200px] relative group"
                    style={{
                      background: showSnippet === i ? "rgba(139,92,246,0.06)" : "var(--surface)",
                      border: showSnippet === i
                        ? "1px solid rgba(139,92,246,0.25)"
                        : "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformBadge platform={stage.platform ?? ""} label={stage.platformLabel ?? stage.platform ?? ""} />
                    </div>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                      {stage.stageName || `Stage ${i + 1}`}
                    </p>
                    {stage.triggerCondition && (
                      <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                        Trigger: {stage.triggerCondition}
                      </p>
                    )}
                    {(stage.gateChecks?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stage.gateChecks!.map((g, j) => (
                          <span
                            key={j}
                            className="text-[9px] px-1 py-0.5 rounded"
                            style={{ background: "rgba(16,185,129,0.08)", color: "#34d399" }}
                          >
                            ✓ {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {stage.configSnippet && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                          {stage.configLanguage || "yaml"}
                        </span>
                      </div>
                    )}
                  </button>
                  {i < stages.length - 1 && (
                    <div className="flex items-center">
                      <svg width="20" height="12" viewBox="0 0 20 12" className="opacity-30">
                        <path d="M0 6h16M14 2l4 4-4 4" stroke="#8b5cf6" strokeWidth="1.5" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </div>
          </div>
          {showSnippet !== null && stages[showSnippet]?.configSnippet && (
            <div
              className="mt-2 rounded-lg overflow-hidden animate-in"
              style={{ border: "1px solid rgba(139,92,246,0.15)" }}
            >
              <div
                className="flex items-center justify-between px-3 py-1.5"
                style={{ background: "rgba(139,92,246,0.06)", borderBottom: "1px solid rgba(139,92,246,0.1)" }}
              >
                <span className="text-[10px] font-medium" style={{ color: "#a78bfa" }}>
                  {stages[showSnippet].platformLabel} — {stages[showSnippet].stageName}
                </span>
                <div className="flex items-center gap-2">
                  <CopyButton text={stages[showSnippet].configSnippet!} />
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>
                    {stages[showSnippet].configLanguage}
                  </span>
                </div>
              </div>
              <pre
                className="p-3 text-[11px] leading-relaxed overflow-x-auto"
                style={{ background: "var(--background)", color: "var(--foreground-muted)" }}
              >
                {stages[showSnippet].configSnippet}
              </pre>
            </div>
          )}
        </section>
      )}

      {/* Environment Promotion Gates */}
      {gates.length > 0 && (
        <section>
          <SectionHeader icon={<ShieldIcon />} title="Environment Promotion Gates" color="#06d6d6" />
          <div className="mt-3 space-y-2">
            {gates.map((gate, i) => (
              <div
                key={i}
                className="rounded-lg p-3 flex items-center gap-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <EnvBadge env={gate.fromEnv ?? "?"} />
                  <svg width="36" height="14" viewBox="0 0 36 14" className="shrink-0">
                    <defs>
                      <linearGradient id={`gateGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(6,214,214,0.3)" />
                        <stop offset="100%" stopColor="rgba(6,214,214,0.9)" />
                      </linearGradient>
                    </defs>
                    <path d="M0 7h28M26 3l5 4-5 4" stroke={`url(#gateGrad${i})`} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <EnvBadge env={gate.toEnv ?? "?"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {(gate.requiredChecks ?? []).map((check, j) => (
                      <span
                        key={j}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(6,214,214,0.06)", color: "#06d6d6", border: "1px solid rgba(6,214,214,0.1)" }}
                      >
                        {check}
                      </span>
                    ))}
                    {gate.newmanSuiteRef && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                        Newman: {gate.newmanSuiteRef}
                      </span>
                    )}
                  </div>
                </div>
                {gate.approvalRequired && (
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.15)" }}
                  >
                    APPROVAL REQUIRED
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Go-Live Criteria */}
      {goLive.length > 0 && (
        <section>
          <SectionHeader icon={<ChecklistIcon />} title="Go-Live Criteria" color="#10b981" count={`${goLive.length} of ${goLive.length}`} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {goLive.map((criterion, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2 flex items-start gap-2"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3.5" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{criterion}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Training & Communication */}
      {(training.length > 0 || comms.length > 0) && (
        <div className={`grid gap-4 ${training.length > 0 && comms.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
          {training.length > 0 && (
            <section>
              <SectionHeader icon={<UsersIcon />} title="Training Requirements" color="#3b82f6" />
              <div className="mt-3 space-y-2">
                {training.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{t.topic || "Training"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {t.audience && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.08)", color: "#60a5fa" }}>
                          {t.audience}
                        </span>
                      )}
                      {t.format && (
                        <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                          {t.format}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {comms.length > 0 && (
            <section>
              <SectionHeader icon={<MessageIcon />} title="Communication Plan" color="#f59e0b" />
              <div className="mt-3 space-y-2">
                {comms.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{c.stakeholder || "Stakeholder"}</p>
                      {c.timing && (
                        <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{c.timing}</span>
                      )}
                    </div>
                    {c.message && (
                      <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "var(--foreground-muted)" }}>{c.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Change Management Notes */}
      {changeNotes.length > 0 && (
        <section>
          <SectionHeader icon={<NoteIcon />} title="Change Management" color="var(--foreground-muted)" />
          <ul className="mt-3 space-y-1.5 ml-1">
            {changeNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: "var(--foreground-dim)" }} />
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: `${color}08`, border: `1px solid ${color}15` }}
    >
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title, color, count }: { icon: React.ReactNode; title: string; color: string; count?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: `${color}12`, color }}
      >
        {icon}
      </div>
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{title}</h3>
      {count && (
        <span className="text-[10px] font-medium" style={{ color: "var(--foreground-dim)" }}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${color}30, transparent)` }} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="text-[9px] px-2 py-0.5 rounded transition-all duration-200"
      style={{
        background: copied ? "rgba(34,197,94,0.15)" : "rgba(139,92,246,0.1)",
        color: copied ? "#34d399" : "#a78bfa",
        border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(139,92,246,0.15)"}`,
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: "var(--foreground-dim)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function PlatformBadge({ platform, label }: { platform: string; label: string }) {
  const colors: Record<string, string> = {
    github_actions: "#fff",
    gitlab_ci: "#fc6d26",
    jenkins: "#d33833",
    circleci: "#343434",
    azure_devops: "#0078d4",
    aws_codepipeline: "#ff9900",
    bitbucket_pipelines: "#2684ff",
    tekton: "#fd495c",
  };
  const c = colors[platform] ?? "#8b5cf6";
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
      style={{ background: `${c}15`, color: c, border: `1px solid ${c}25` }}
    >
      {label || platform}
    </span>
  );
}

function EnvBadge({ env }: { env: string }) {
  const lower = env.toLowerCase();
  const color = lower.includes("prod") ? "#ef4444" : lower.includes("stag") ? "#f59e0b" : "#06d6d6";
  return (
    <span
      className="text-[10px] font-bold px-2 py-1 rounded-md"
      style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}
    >
      {env}
    </span>
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
function RocketIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
