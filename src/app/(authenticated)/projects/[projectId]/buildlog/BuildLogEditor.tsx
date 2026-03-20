"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveBuildLog } from "@/lib/actions/admin";
import { requestProjectCompletion, draftBuildLogSection, getCompletionGateStatus } from "@/lib/actions/projects";
import { useToast } from "@/components/Toast";
import type { BuildLogData } from "@/lib/engagement";

interface DeliveryGate {
  label: string;
  passed: boolean;
  href: string | null;
}

interface Props {
  projectId: string;
  initial: BuildLogData;
  previousVersion?: BuildLogData | null;
  deliveryGates?: DeliveryGate[];
}

export function BuildLogEditor({ projectId, initial, previousVersion, deliveryGates: _deliveryGates }: Props) {
  const [data, setData] = useState<BuildLogData>(initial);
  const [saving, startSave] = useTransition();
  const [completing, startComplete] = useTransition();
  const [completeResult, setCompleteResult] = useState<{ ok: boolean; text: string; gates?: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  const [gateStatus, setGateStatus] = useState<{ gates: DeliveryGate[]; allPassed: boolean } | null>(null);
  const [loadingGates, setLoadingGates] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function setCtx(key: keyof BuildLogData["context"], val: string) {
    setData((d) => ({ ...d, context: { ...d.context, [key]: val } }));
  }
  function setEnv(key: keyof BuildLogData["environmentBaseline"], val: string) {
    setData((d) => ({ ...d, environmentBaseline: { ...d.environmentBaseline, [key]: val } }));
  }
  function setList(key: "successCriteria" | "internalProof" | "whatWeBuilt" | "valueUnlocked" | "reusablePatterns" | "implementationKit" | "productGapsRisks" | "nextSteps", val: string) {
    setData((d) => ({ ...d, [key]: val.split("\n").filter(Boolean) }));
  }

  function handleSave() {
    startSave(async () => {
      try {
        await saveBuildLog(projectId, data as unknown as Record<string, unknown>);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        toast.success("Build log saved");
        router.refresh();
      } catch (err) {
        toast.error("Failed to save build log", err instanceof Error ? err.message : undefined);
      }
    });
  }

  async function handleDraft(sectionKey: string) {
    setDrafting(sectionKey);
    try {
      const res = await draftBuildLogSection(projectId, sectionKey);
      if (res.draft) {
        if (sectionKey === "useCase" || sectionKey === "caseStudySummary" || sectionKey === "nextMotion") {
          setData((d) => ({ ...d, [sectionKey]: res.draft! }));
        } else {
          const items = res.draft!
            .split("\n")
            .map((l) => l.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
            .filter(Boolean);
          setData((d) => ({ ...d, [sectionKey]: items }));
        }
      }
    } finally {
      setDrafting(null);
    }
  }

  function handleExportMarkdown() {
    const md = toMarkdown(data);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "build-log.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCompletionDryRun() {
    setLoadingGates(true);
    try {
      const status = await getCompletionGateStatus(projectId);
      setGateStatus(status);
      setShowGateModal(true);
    } finally {
      setLoadingGates(false);
    }
  }

  function handleConfirmComplete() {
    setShowGateModal(false);
    startComplete(async () => {
      const res = await requestProjectCompletion(projectId);
      if (res.error) {
        setCompleteResult({ ok: false, text: res.error, gates: res.failedGates });
        toast.error("Completion failed", res.error);
      } else {
        setCompleteResult({ ok: true, text: "Project completed! Use case validated." });
        toast.success("Project completed", "Use case validated — ready for transition");
        router.refresh();
      }
    });
  }

  const completeness = getSectionCompleteness(data);
  const completedCount = Object.values(completeness).filter(Boolean).length;
  const totalSections = Object.keys(completeness).length;
  const progressPct = Math.round((completedCount / totalSections) * 100);

  const diffSummary = showDiff && previousVersion ? computeDiffSummary(data, previousVersion) : [];

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-1";
  const inputStyle = {
    background: "var(--surface)",
    borderColor: "var(--border)",
    color: "var(--foreground)",
  };
  const labelCls = "block text-xs font-semibold mb-1.5";
  const labelStyle = { color: "var(--foreground-muted)" };

  return (
    <div className="space-y-8">
      {/* Section Progress */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
            Build Log Completion
          </span>
          <span className="text-xs font-medium" style={{ color: progressPct === 100 ? "#34d399" : "var(--foreground-dim)" }}>
            {completedCount}/{totalSections} sections · {progressPct}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: progressPct === 100
                ? "linear-gradient(to right, #10b981, #34d399)"
                : "linear-gradient(to right, #f59e0b, #fbbf24)",
            }}
          />
        </div>
      </div>

      {/* Version Comparison */}
      {previousVersion && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all shrink-0"
            style={{
              background: showDiff ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
              color: showDiff ? "#a78bfa" : "var(--foreground-muted)",
              border: `1px solid ${showDiff ? "rgba(139,92,246,0.2)" : "var(--border)"}`,
            }}
          >
            {showDiff ? "Hide comparison" : "Compare with previous"}
          </button>
          {showDiff && diffSummary.length > 0 && (
            <div className="flex-1 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-1" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.1)", color: "#c4b5fd" }}>
              {diffSummary.map((d, i) => <span key={i}>• {d}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Context */}
      <Section title="Context" icon="C" color="#3b82f6" complete={completeness.context}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>SE / CSE</label>
            <input className={inputCls} style={inputStyle} value={data.context.seCse}
              onChange={(e) => setCtx("seCse", e.target.value)} placeholder="e.g. Craig (SE), Hammad (CSE)" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Executive Sponsor</label>
            <input className={inputCls} style={inputStyle} value={data.context.executiveSponsor}
              onChange={(e) => setCtx("executiveSponsor", e.target.value)} placeholder="e.g. VP Engineering, CTO" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Customer Technical Lead</label>
            <input className={inputCls} style={inputStyle} value={data.context.customerTechnicalLead}
              onChange={(e) => setCtx("customerTechnicalLead", e.target.value)} placeholder="e.g. Tom Testo (Platform Eng)" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Pilot Timeline</label>
            <input className={inputCls} style={inputStyle} value={data.context.pilotTimeline}
              onChange={(e) => setCtx("pilotTimeline", e.target.value)} placeholder="e.g. 60-day pilot, working sessions Thursdays 2PM EST" />
          </div>
        </div>
      </Section>

      {/* Use Case */}
      <Section title="Use Case" icon="U" color="#8b5cf6" complete={completeness.useCase} onDraft={() => handleDraft("useCase")} draftLoading={drafting === "useCase"}>
        <div className="space-y-3">
          <div>
            <label className={labelCls} style={labelStyle}>Use Case (one sentence)</label>
            <input className={inputCls} style={inputStyle} value={data.useCaseOneSentence}
              onChange={(e) => setData((d) => ({ ...d, useCaseOneSentence: e.target.value }))}
              placeholder="e.g. Activate API Governance rulesets to enforce spec-first development across 200 microservices." />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Use Case Detail</label>
            <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }} value={data.useCase}
              onChange={(e) => setData((d) => ({ ...d, useCase: e.target.value }))}
              placeholder="Describe the advanced use case being activated: what workflow are we embedding Postman into, what systems are involved, and what does the customer expect to achieve?" />
          </div>
        </div>
      </Section>

      {/* Success Criteria */}
      <Section title="Success Criteria" icon="S" color="#22c55e" complete={completeness.successCriteria} onDraft={() => handleDraft("successCriteria")} draftLoading={drafting === "successCriteria"}>
        <label className={labelCls} style={labelStyle}>One criterion per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 100 }}
          value={data.successCriteria.join("\n")}
          onChange={(e) => setList("successCriteria", e.target.value)}
          placeholder={"Heatmap service spec onboarded via GitHub Action with zero manual steps\nBaseline, smoke, and contract collections auto-generated from spec"} />
      </Section>

      {/* Environment Baseline */}
      <Section title="Environment Baseline" icon="E" color="#f59e0b" complete={completeness.environmentBaseline}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ["scm", "SCM", "e.g. GitHub"],
            ["ciCd", "CI/CD", "e.g. GitHub Actions"],
            ["gateway", "Gateway", "e.g. AWS API Gateway"],
            ["cloud", "Cloud", "e.g. AWS"],
            ["devPortal", "Dev Portal / IDP", "e.g. Backstage"],
            ["secretsManagement", "Secrets Management", "e.g. Vault, AWS Secrets Manager"],
            ["currentPostmanUsage", "Current Postman Usage", "e.g. Extensive smoke/contract"],
            ["version", "v11/v12", "e.g. v12"],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key}>
              <label className={labelCls} style={labelStyle}>{label}</label>
              <input className={inputCls} style={inputStyle}
                value={data.environmentBaseline[key]}
                onChange={(e) => setEnv(key, e.target.value)}
                placeholder={placeholder} />
            </div>
          ))}
        </div>
      </Section>

      {/* Internal Proof */}
      <Section title="Internal Proof" icon="P" color="#a855f7" complete={completeness.internalProof} onDraft={() => handleDraft("internalProof")} draftLoading={drafting === "internalProof"}>
        <label className={labelCls} style={labelStyle}>What was proven internally before customer implementation — one item per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }}
          value={data.internalProof.join("\n")}
          onChange={(e) => setList("internalProof", e.target.value)}
          placeholder={"Governance ruleset tested against sample OpenAPI specs\nCI/CD pipeline template validated in internal repo\nCollection generation from spec proven end-to-end"} />
      </Section>

      {/* What We Built */}
      <Section title="What We Built" icon="W" color="#06b6d4" complete={completeness.whatWeBuilt} onDraft={() => handleDraft("whatWeBuilt")} draftLoading={drafting === "whatWeBuilt"}>
        <label className={labelCls} style={labelStyle}>One artifact per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 100 }}
          value={data.whatWeBuilt.join("\n")}
          onChange={(e) => setList("whatWeBuilt", e.target.value)}
          placeholder={"GitHub Action workflow calling postman-api-onboarding-action@v0\nMock heatmap OpenAPI spec\nAutomated workspace creation"} />
      </Section>

      {/* Value Unlocked */}
      <Section title="Value Unlocked" icon="V" color="#10b981" complete={completeness.valueUnlocked} onDraft={() => handleDraft("valueUnlocked")} draftLoading={drafting === "valueUnlocked"}>
        <label className={labelCls} style={labelStyle}>One outcome or metric per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }}
          value={data.valueUnlocked.join("\n")}
          onChange={(e) => setList("valueUnlocked", e.target.value)}
          placeholder={"Zero-touch API onboarding: spec change → workspace + collections + catalog in one push\nCI-based smoke/contract testing replaces manual monitor usage"} />
      </Section>

      {/* Reusable Patterns */}
      <Section title="Reusable Patterns" icon="R" color="#a855f7" complete={completeness.reusablePatterns} onDraft={() => handleDraft("reusablePatterns")} draftLoading={drafting === "reusablePatterns"}>
        <label className={labelCls} style={labelStyle}>Templates or patterns to extract — one per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }}
          value={data.reusablePatterns.join("\n")}
          onChange={(e) => setList("reusablePatterns", e.target.value)}
          placeholder={"postman-api-onboarding-action@v0 composite action\nLocal HTTP server fallback for private repos"} />
      </Section>

      {/* Product Gaps / Risks */}
      <Section title="Product Gaps / Risks" icon="!" color="#ef4444" complete={completeness.productGapsRisks} onDraft={() => handleDraft("productGapsRisks")} draftLoading={drafting === "productGapsRisks"}>
        <label className={labelCls} style={labelStyle}>One gap or risk per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }}
          value={data.productGapsRisks.join("\n")}
          onChange={(e) => setList("productGapsRisks", e.target.value)}
          placeholder={"POSTMAN_ACCESS_TOKEN: session-scoped, expires, no programmatic refresh\nService graph does not work with Lambda"} />
      </Section>

      {/* Implementation Kit */}
      <Section title="Implementation Kit" icon="K" color="#14b8a6" complete={completeness.implementationKit} onDraft={() => handleDraft("implementationKit")} draftLoading={drafting === "implementationKit"}>
        <label className={labelCls} style={labelStyle}>Artifacts for the customer / PS / partners to scale — one per line</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }}
          value={data.implementationKit.join("\n")}
          onChange={(e) => setList("implementationKit", e.target.value)}
          placeholder={"Setup guide: governance rulesets + CI enforcement\nTemplate CI/CD workflow for spec-first onboarding\nRollout checklist for additional teams"} />
      </Section>

      {/* Case Study */}
      <Section title="Case Study Summary" icon="📋" color="#c9a227" complete={completeness.caseStudySummary} onDraft={() => handleDraft("caseStudySummary")} draftLoading={drafting === "caseStudySummary"}>
        <label className={labelCls} style={labelStyle}>What changed, how the use case was implemented, what value it delivered, and why it matters</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 100 }} value={data.caseStudySummary}
          onChange={(e) => setData((d) => ({ ...d, caseStudySummary: e.target.value }))}
          placeholder="Customer implemented API Governance rulesets across 200 microservices, reducing spec violations by 85% in 6 weeks. CI/CD enforcement ensures no non-compliant API can reach production. Pattern is now being rolled out to partner-facing APIs." />
      </Section>

      {/* Next Motion */}
      <Section title="Next Motion" icon="⟳" color="#6366f1" complete={completeness.nextMotion} onDraft={() => handleDraft("nextMotion")} draftLoading={drafting === "nextMotion"}>
        <label className={labelCls} style={labelStyle}>Who owns the next phase: customer self-service, PS, partner rollout, new CSE engagement, or transition back to Sales</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 60 }} value={data.nextMotion}
          onChange={(e) => setData((d) => ({ ...d, nextMotion: e.target.value }))}
          placeholder="e.g. Transition to PS for paid rollout across remaining 150 services. Customer team self-sufficient on governance setup." />
      </Section>

      {/* Next Steps */}
      <Section title="Next Steps" icon="→" color="#06d6d6" complete={completeness.nextSteps} onDraft={() => handleDraft("nextSteps")} draftLoading={drafting === "nextSteps"}>
        <label className={labelCls} style={labelStyle}>One per line — PS / TAM / next sprint / stop</label>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }}
          value={data.nextSteps.join("\n")}
          onChange={(e) => setList("nextSteps", e.target.value)}
          placeholder={"Hand off implementation kit to PS lead (scheduled)\nCustomer advocacy intro call next week\nCSE redeployed to next qualified engagement"} />
      </Section>

      {/* Save & Complete */}
      <div className="flex items-center gap-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: saving ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.15)",
            color: "#34d399",
            border: "1px solid rgba(16,185,129,0.2)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Build Log"}
        </button>
        <button
          onClick={handleExportMarkdown}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: "rgba(6,182,212,0.12)",
            color: "#22d3ee",
            border: "1px solid rgba(6,182,212,0.2)",
          }}
        >
          Download Markdown
        </button>
        <button
          onClick={() => {
            setCompleteResult(null);
            handleCompletionDryRun();
          }}
          disabled={completing || loadingGates}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: completing || loadingGates ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.12)",
            color: "#a78bfa",
            border: "1px solid rgba(139,92,246,0.2)",
            opacity: completing || loadingGates ? 0.6 : 1,
          }}
        >
          {loadingGates ? "Checking gates..." : completing ? "Completing..." : "Complete Project"}
        </button>
        {saved && (
          <span className="text-xs font-medium" style={{ color: "#34d399" }}>
            Saved successfully
          </span>
        )}
      </div>
      {completeResult && (
        <div className="mt-3 rounded-lg px-4 py-3 text-sm" style={{
          background: completeResult.ok ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
          border: `1px solid ${completeResult.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
          color: completeResult.ok ? "#34d399" : "#f87171",
        }}>
          <p className="font-medium">{completeResult.text}</p>
          {completeResult.gates && completeResult.gates.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {completeResult.gates.map((g) => (
                <li key={g} className="text-xs flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Completion Dry-Run Gate Modal */}
      {showGateModal && gateStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl p-6 max-w-md w-full mx-4" style={{ background: "var(--surface-raised, var(--surface))", border: "1px solid var(--border)" }}>
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--foreground)" }}>
              Delivery Gate Checklist
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--foreground-dim)" }}>
              {gateStatus.allPassed ? "All gates passed — ready to complete." : "Some gates are not met yet."}
            </p>
            <div className="space-y-2.5 mb-5">
              {gateStatus.gates.map((gate) => (
                <div key={gate.label} className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: gate.passed ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.08)",
                      border: `1.5px solid ${gate.passed ? "#34d399" : "#f87171"}`,
                    }}
                  >
                    {gate.passed ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  {gate.href && !gate.passed ? (
                    <Link
                      href={gate.href}
                      className="text-xs hover:underline"
                      style={{ color: "#f87171" }}
                    >
                      {gate.label} →
                    </Link>
                  ) : (
                    <span className="text-xs" style={{ color: gate.passed ? "#34d399" : "#f87171" }}>
                      {gate.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {gateStatus.allPassed && (
                <button
                  onClick={handleConfirmComplete}
                  disabled={completing}
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: "rgba(16,185,129,0.15)",
                    color: "#34d399",
                    border: "1px solid rgba(16,185,129,0.25)",
                  }}
                >
                  {completing ? "Completing..." : "Confirm Completion"}
                </button>
              )}
              <button
                onClick={() => setShowGateModal(false)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--foreground-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {gateStatus.allPassed ? "Cancel" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, color, children, complete, onDraft, draftLoading }: {
  title: string; icon: string; color: string; children: React.ReactNode;
  complete?: boolean; onDraft?: () => void; draftLoading?: boolean;
}) {
  return (
    <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, ${color}60, ${color}15, transparent)` }} />
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
        >
          {icon}
        </div>
        <h3 className="text-sm font-semibold" style={{ color }}>{title}</h3>
        {complete !== undefined && (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: complete ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }}
            title={complete ? "Complete" : "Needs content"}
          >
            {complete ? (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
              </svg>
            )}
          </div>
        )}
        {onDraft && (
          <button
            onClick={onDraft}
            disabled={draftLoading}
            className="ml-auto text-[10px] px-2.5 py-1 rounded-md font-medium transition-all"
            style={{
              background: draftLoading ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.1)",
              color: "#a78bfa",
              border: "1px solid rgba(139,92,246,0.15)",
              opacity: draftLoading ? 0.6 : 1,
            }}
          >
            {draftLoading ? "Drafting..." : "Draft with AI"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function getSectionCompleteness(data: BuildLogData): Record<string, boolean> {
  const env = data.environmentBaseline;
  return {
    context: !!(data.context.seCse && data.context.customerTechnicalLead && data.context.pilotTimeline),
    useCase: !!(data.useCase.trim() && data.useCaseOneSentence.trim()),
    successCriteria: data.successCriteria.length > 0,
    environmentBaseline: Object.values(env).filter((v) => typeof v === "string" && v.trim()).length >= 3,
    internalProof: data.internalProof.length > 0,
    whatWeBuilt: data.whatWeBuilt.length > 0,
    valueUnlocked: data.valueUnlocked.length > 0,
    reusablePatterns: data.reusablePatterns.length > 0,
    implementationKit: data.implementationKit.length > 0,
    productGapsRisks: data.productGapsRisks.length > 0,
    caseStudySummary: !!data.caseStudySummary.trim(),
    nextMotion: !!data.nextMotion.trim(),
    nextSteps: data.nextSteps.length > 0,
  };
}

function computeDiffSummary(current: BuildLogData, prev: BuildLogData): string[] {
  const changes: string[] = [];
  if (current.useCase !== prev.useCase) changes.push("Use case updated");
  if (current.useCaseOneSentence !== prev.useCaseOneSentence) changes.push("Use case summary updated");
  if (current.caseStudySummary !== prev.caseStudySummary) changes.push("Case study updated");
  if (current.nextMotion !== prev.nextMotion) changes.push("Next motion updated");
  const listKeys = ["successCriteria", "internalProof", "whatWeBuilt", "valueUnlocked", "reusablePatterns", "implementationKit", "productGapsRisks", "nextSteps"] as const;
  for (const key of listKeys) {
    const added = current[key].filter((v) => !prev[key].includes(v)).length;
    const removed = prev[key].filter((v) => !current[key].includes(v)).length;
    if (added > 0 || removed > 0) {
      changes.push(`${key}: +${added}/-${removed}`);
    }
  }
  for (const key of ["seCse", "executiveSponsor", "customerTechnicalLead", "pilotTimeline"] as const) {
    if (current.context[key] !== prev.context[key]) changes.push(`Context.${key} changed`);
  }
  return changes.length > 0 ? changes : ["No changes"];
}

function toMarkdown(d: BuildLogData): string {
  const lines: string[] = ["# Build Log\n"];
  lines.push("## Context");
  lines.push(`- **SE / CSE:** ${d.context.seCse || "—"}`);
  lines.push(`- **Executive Sponsor:** ${d.context.executiveSponsor || "—"}`);
  lines.push(`- **Customer Technical Lead:** ${d.context.customerTechnicalLead || "—"}`);
  lines.push(`- **Pilot Timeline:** ${d.context.pilotTimeline || "—"}\n`);
  lines.push("## Use Case");
  lines.push(`**Summary:** ${d.useCaseOneSentence || "—"}\n`);
  lines.push(`${d.useCase || "—"}\n`);
  lines.push("## Success Criteria");
  d.successCriteria.forEach((c) => lines.push(`- ${c}`));
  lines.push("");
  lines.push("## Environment Baseline");
  lines.push(`- **SCM:** ${d.environmentBaseline.scm || "—"}`);
  lines.push(`- **CI/CD:** ${d.environmentBaseline.ciCd || "—"}`);
  lines.push(`- **Gateway:** ${d.environmentBaseline.gateway || "—"}`);
  lines.push(`- **Cloud:** ${d.environmentBaseline.cloud || "—"}`);
  lines.push(`- **Dev Portal / IDP:** ${d.environmentBaseline.devPortal || "—"}`);
  lines.push(`- **Secrets Management:** ${d.environmentBaseline.secretsManagement || "—"}`);
  lines.push(`- **Current Postman Usage:** ${d.environmentBaseline.currentPostmanUsage || "—"}`);
  lines.push(`- **v11/v12:** ${d.environmentBaseline.version || "—"}\n`);
  lines.push("## Internal Proof");
  d.internalProof.forEach((p) => lines.push(`- ${p}`));
  lines.push("");
  lines.push("## What We Built");
  d.whatWeBuilt.forEach((b) => lines.push(`- ${b}`));
  lines.push("");
  lines.push("## Value Unlocked");
  d.valueUnlocked.forEach((v) => lines.push(`- ${v}`));
  lines.push("");
  lines.push("## Reusable Patterns");
  d.reusablePatterns.forEach((p) => lines.push(`- ${p}`));
  lines.push("");
  lines.push("## Implementation Kit");
  d.implementationKit.forEach((k) => lines.push(`- ${k}`));
  lines.push("");
  lines.push("## Product Gaps / Risks");
  d.productGapsRisks.forEach((g) => lines.push(`- ${g}`));
  lines.push("");
  lines.push("## Case Study Summary");
  lines.push(`${d.caseStudySummary || "—"}\n`);
  lines.push("## Next Motion");
  lines.push(`${d.nextMotion || "—"}\n`);
  lines.push("## Next Steps");
  d.nextSteps.forEach((n) => lines.push(`- ${n}`));
  return lines.join("\n");
}
