"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitArchitectureMap,
  type ServiceEntry,
  type ArchitectureFormData,
  type GovernanceStage,
  type BackfillStrategy,
  type DiscoveryAnswers,
} from "@/lib/actions/architect";
import { generateArchitectShareLink } from "@/lib/actions/architect-share";

const POSTMAN_ORANGE = "#FF6C37";

const SCM_OPTIONS = ["GitHub", "GitLab", "Bitbucket", "Azure DevOps", "Other"];
const CICD_OPTIONS = ["GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "Azure Pipelines", "Argo CD", "Other"];
const GATEWAY_OPTIONS = ["Kong", "Apigee", "AWS API Gateway", "Azure API Management", "Nginx", "Envoy", "MuleSoft", "Tyk", "None", "Other"];
const CLOUD_OPTIONS = ["AWS", "Azure", "GCP", "Multi-cloud", "On-Premise", "Hybrid", "Other"];
const IDP_OPTIONS = ["Okta", "Auth0", "Azure AD / Entra ID", "AWS Cognito", "Keycloak", "PingIdentity", "Custom", "None"];
const SECRET_OPTIONS = ["HashiCorp Vault", "AWS Secrets Manager", "Azure Key Vault", "GCP Secret Manager", "CyberArk", "Doppler", "Environment Variables", "Other"];
const MONITORING_OPTIONS = ["Datadog", "New Relic", "Prometheus + Grafana", "Splunk", "Dynatrace", "PagerDuty", "CloudWatch", "Azure Monitor", "None", "Other"];
const SPEC_HOSTING_OPTIONS = ["SwaggerHub", "Spec Hub (Postman)", "Stoplight", "Redocly", "Custom", "None"];
const OBSERVABILITY_OPTIONS = ["Datadog", "Dynatrace", "New Relic", "Splunk", "Honeycomb", "Lightstep", "Jaeger", "None", "Other"];
const POSTMAN_PLANS = ["Free", "Basic", "Professional", "Enterprise", "Enterprise Ultimate"];
const API_TYPES: ServiceEntry["type"][] = ["REST", "GraphQL", "gRPC", "AsyncAPI", "SOAP", "Other"];
const SPEC_FORMATS = ["OpenAPI 3.x", "OpenAPI 2.0 / Swagger", "AsyncAPI", "GraphQL SDL", "Protobuf", "WSDL", "None"];
const DEFAULT_ENVS = ["dev", "qa", "staging", "prod"];

const INFRA_INTEGRATION_MAP: Record<string, { label: string; integration: string }> = {
  scm: { label: "Source Control", integration: "Filesystem integration (workspace linked to repo); GitHub Actions / GitLab CI for test execution" },
  ciCd: { label: "CI/CD", integration: "Postman CLI runs tests in pipeline; results feed to API Catalog" },
  gateway: { label: "API Gateway", integration: "Gateway apps import deployed APIs; or CLI-based import from gateway specs" },
  idp: { label: "IDP", integration: "Postman API calls to create workspace, collections, environments at provisioning time" },
  secretManager: { label: "Secret Manager", integration: "Pre-request scripts resolve secrets at runtime; no secrets stored in Postman" },
  monitoring: { label: "Monitoring", integration: "Postman Monitors -> Slack/Teams/PagerDuty; Monitor data feeds catalog Monitor tab" },
  specHosting: { label: "Spec Hosting", integration: "Spec Hub replaces SwaggerHub; or import from SwaggerHub into Spec Hub" },
  observability: { label: "Observability", integration: "Insights Agent captures runtime traffic; Agent Mode can correlate with third-party data via MCP" },
};

const DEFAULT_GOVERNANCE_STAGES: GovernanceStage[] = [
  { stage: "design", enabled: false, rules: ["Spec linting via Spectral rules", "Naming conventions enforced", "Versioning strategy validated", "Deprecation headers required"] },
  { stage: "commit", enabled: false, rules: ["Spec compliance check", "Breaking change detection", "PR checks via Postman CLI"] },
  { stage: "cicd", enabled: false, rules: ["Contract tests pass", "Smoke tests pass", "Spec quality gate", "Blocks deployment on failure"] },
  { stage: "deploy", enabled: false, rules: ["Post-deployment smoke tests", "Environment variable validation", "Postman CLI post-deploy job"] },
  { stage: "ongoing", enabled: false, rules: ["Schema drift detection", "Production health monitoring", "Monitors + Insights Agent feed API Catalog"] },
];

const GOVERNANCE_STAGE_META: Record<string, { title: string; subtitle: string; color: string }> = {
  design: { title: "At Design Time", subtitle: "Spec Hub governance rules (Spectral) — real-time inline feedback", color: "#8b5cf6" },
  commit: { title: "At Commit Time", subtitle: "Git pre-commit hooks or PR checks via Postman CLI", color: "#3b82f6" },
  cicd: { title: "At CI/CD Time", subtitle: "Postman CLI in pipeline — blocks deployment on failure", color: POSTMAN_ORANGE },
  deploy: { title: "At Deploy Time", subtitle: "Postman CLI post-deploy job", color: "#22c55e" },
  ongoing: { title: "Ongoing", subtitle: "Monitors + Insights Agent — feeds API Catalog", color: "#06b6d4" },
};

const EMPTY_SERVICE: ServiceEntry = {
  domain: "",
  name: "",
  purpose: "",
  type: "REST",
  repo: "",
  owner: "",
  environments: [...DEFAULT_ENVS],
  hasSpec: false,
  specFormat: "",
  ciCdIntegrated: false,
  hasWorkspace: false,
  repoLinked: false,
  inCatalog: false,
  catalogIngestion: "",
};

const EMPTY_DISCOVERY: DiscoveryAnswers = {
  provisioningFlow: "",
  specLocation: "",
  catalogSystem: "",
  secretHandling: "",
  painPoints: [],
  idealStakeholder: "",
  pocTarget: "",
};

const PAIN_POINTS = [
  "No centralized API catalog — tribal knowledge",
  "No automated test generation for APIs",
  "No visibility for platform engineering leaders",
  "Manual Postman setup — zero standardization",
  "Hardcoded secrets in collections",
  "New engineers take 2-3 days to find internal APIs",
  "Teams rebuild APIs that already exist",
  "Production incidents from shadow APIs and spec drift",
  "Cannot articulate Postman's value — not embedded in workflow",
  "Orphaned Postman setups when employees leave",
  "No inventory of secrets/variables across collections",
  "Cost of spinning up non-functional dev services",
  "No Postman in provisioning flow",
];

const EMPTY_BACKFILL: BackfillStrategy = {
  gatewayImport: false,
  insightsAgent: false,
  workspaceMigration: false,
  cliBatchImport: false,
  manual: false,
  estimatedExistingApis: "",
  backfillNotes: "",
};

interface Props {
  projects: Array<{ id: string; name: string; primaryDomain: string | null; engagementStage: number }>;
}

export function ArchitectClient({ projects }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [step, setStepRaw] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const setStep = useCallback((v: number | ((prev: number) => number)) => {
    setStepRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      setMaxVisited((m) => Math.max(m, next));
      return next;
    });
  }, []);

  const [companyName, setCompanyName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [scm, setScm] = useState("");
  const [ciCd, setCiCd] = useState("");
  const [gateway, setGateway] = useState("");
  const [cloud, setCloud] = useState("");
  const [idp, setIdp] = useState("");
  const [secretManager, setSecretManager] = useState("");
  const [devPortal, setDevPortal] = useState("");
  const [monitoring, setMonitoring] = useState("");
  const [specHosting, setSpecHosting] = useState("");
  const [observability, setObservability] = useState("");
  const [currentPostmanUsage, setCurrentPostmanUsage] = useState("");
  const [postmanPlan, setPostmanPlan] = useState("");
  const [workspaceStrategy, setWorkspaceStrategy] = useState("One workspace per service");
  const [namingConvention, setNamingConvention] = useState("[domain]-[service]-[purpose]");
  const [services, setServices] = useState<ServiceEntry[]>([{ ...EMPTY_SERVICE }]);
  const [deploymentTargets, setDeploymentTargets] = useState<string[]>([...DEFAULT_ENVS]);
  const [governanceRules, setGovernanceRules] = useState<string[]>([]);
  const [governanceStages, setGovernanceStages] = useState<GovernanceStage[]>(DEFAULT_GOVERNANCE_STAGES.map((g) => ({ ...g, rules: [...g.rules] })));
  const [governanceGroupScope, setGovernanceGroupScope] = useState("");
  const [backfill, setBackfill] = useState<BackfillStrategy>({ ...EMPTY_BACKFILL });
  const [discovery, setDiscovery] = useState<DiscoveryAnswers>({ ...EMPTY_DISCOVERY, painPoints: [] });
  const [otherSpecs, setOtherSpecs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState<{ success?: boolean; error?: string; projectName?: string; impactedPhases?: string[] } | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const addService = useCallback(() => {
    setServices((prev) => [...prev, { ...EMPTY_SERVICE }]);
  }, []);

  const removeService = useCallback((idx: number) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const duplicateService = useCallback((idx: number) => {
    setServices((prev) => {
      const clone = { ...prev[idx], name: `${prev[idx].name}-copy` };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
  }, []);

  const updateService = useCallback(<K extends keyof ServiceEntry>(idx: number, key: K, value: ServiceEntry[K]) => {
    setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  }, []);

  const STEPS = [
    { label: "Project & Discovery", shortLabel: "Discover" },
    { label: "Infrastructure", shortLabel: "Infra" },
    { label: "Postman Strategy", shortLabel: "Postman" },
    { label: "Services", shortLabel: "Services" },
    { label: "Governance", shortLabel: "Gov" },
    { label: "Backfill", shortLabel: "Backfill" },
    { label: "Review & Submit", shortLabel: "Submit" },
  ];

  const canAdvance = () => {
    return true;
  };

  const handleSubmit = () => {
    const data: ArchitectureFormData = {
      companyName, primaryDomain, scm, ciCd, gateway, cloud, idp, secretManager,
      devPortal, monitoring, specHosting, observability,
      currentPostmanUsage, postmanPlan, workspaceStrategy, namingConvention,
      services, deploymentTargets, governanceRules, governanceStages,
      governanceGroupScope, backfill, discovery, notes,
    };

    startTransition(async () => {
      const res = await submitArchitectureMap(projectId, data);
      setResult(res);
      if (res.success) {
        setTimeout(() => router.push(`/projects/${projectId}/discovery`), 2500);
      }
    });
  };

  const handleShareForm = async () => {
    if (!projectId) return;
    const prefill: Record<string, unknown> = { companyName, primaryDomain, scm, ciCd, gateway, cloud, idp, secretManager, monitoring, specHosting, observability, services };
    const res = await generateArchitectShareLink(projectId, prefill);
    if (res.token) {
      const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const url = `${base}/architect/fill/${res.token}`;
      setShareLink(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    }
  };

  if (result?.success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div
          className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6"
          style={{ background: `${POSTMAN_ORANGE}15`, border: `1px solid ${POSTMAN_ORANGE}40` }}
        >
          <svg className="w-10 h-10" style={{ color: POSTMAN_ORANGE }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>Architecture Mapped</h2>
        <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>
          <strong style={{ color: POSTMAN_ORANGE }}>{result.projectName}</strong> has been updated with {services.length} services.
        </p>
        {result.impactedPhases && result.impactedPhases.length > 0 && (
          <div className="mt-3 mb-2">
            <p className="text-xs font-medium mb-1.5" style={{ color: "#22c55e" }}>Cascade triggered — {result.impactedPhases.length} phases queued</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {result.impactedPhases.map((p) => (
                <span key={p} className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ background: "rgba(34,197,94,0.08)", color: "#86efac", border: "1px solid rgba(34,197,94,0.12)" }}>{p.replace(/_/g, " ")}</span>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>Redirecting to discovery brief...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${POSTMAN_ORANGE}, #e5593a)` }}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25-4.179 2.25m0 0L12 17.25l-5.571-3m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>Architecture Mapper</h1>
          <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
            Map customer systems, services, and deployment targets into a Postman-ready constellation
          </p>
        </div>
        <button
          onClick={handleShareForm}
          disabled={!projectId}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-30 shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground-muted)" }}
          title="Generate a link to send to the customer so they can fill out the form"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          {shareCopied ? "Link Copied!" : "Share via Email"}
        </button>
      </div>

      {/* Share link banner */}
      {shareLink && (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.142a4.5 4.5 0 00-7.244-1.242l-4.5 4.5a4.5 4.5 0 006.364 6.364l1.757-1.757" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium mb-0.5" style={{ color: "#34d399" }}>Shareable link generated — send this to your customer</p>
            <p className="text-xs font-mono truncate" style={{ color: "var(--foreground-muted)" }}>{shareLink}</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
            className="px-3 py-1 rounded-lg text-[10px] font-medium shrink-0"
            style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
            {shareCopied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center mb-8 gap-1">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isCompleted = i < step;
          const isVisited = i <= maxVisited;
          return (
            <button
              key={s.label}
              onClick={() => { if (isVisited && i !== step) setStep(i); }}
              className="flex-1 flex items-center gap-1.5 px-2 py-2 rounded-lg transition-all text-left"
              style={{
                background: isActive ? `${POSTMAN_ORANGE}12` : isCompleted ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? `${POSTMAN_ORANGE}40` : isCompleted ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`,
                cursor: isVisited && !isActive ? "pointer" : "default",
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{
                  background: isActive ? `${POSTMAN_ORANGE}20` : isCompleted ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                  color: isActive ? POSTMAN_ORANGE : isCompleted ? "#34d399" : "var(--foreground-dim)",
                  border: `1px solid ${isActive ? `${POSTMAN_ORANGE}40` : isCompleted ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              <span
                className="text-[10px] font-medium truncate hidden sm:block"
                style={{ color: isActive ? POSTMAN_ORANGE : isCompleted ? "#34d399" : "var(--foreground-dim)" }}
              >
                {s.label}
              </span>
              <span
                className="text-[9px] font-medium truncate sm:hidden"
                style={{ color: isActive ? POSTMAN_ORANGE : isCompleted ? "#34d399" : "var(--foreground-dim)" }}
              >
                {s.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div
        className="rounded-2xl p-6 sm:p-8 mb-6"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
      >
        {step === 0 && <StepProject projectId={projectId} setProjectId={setProjectId} projects={projects} companyName={companyName} setCompanyName={setCompanyName} primaryDomain={primaryDomain} setPrimaryDomain={setPrimaryDomain} discovery={discovery} setDiscovery={setDiscovery} />}
        {step === 1 && <StepInfrastructure scm={scm} setScm={setScm} ciCd={ciCd} setCiCd={setCiCd} gateway={gateway} setGateway={setGateway} cloud={cloud} setCloud={setCloud} idp={idp} setIdp={setIdp} secretManager={secretManager} setSecretManager={setSecretManager} devPortal={devPortal} setDevPortal={setDevPortal} monitoring={monitoring} setMonitoring={setMonitoring} specHosting={specHosting} setSpecHosting={setSpecHosting} observability={observability} setObservability={setObservability} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />}
        {step === 2 && <StepPostman currentPostmanUsage={currentPostmanUsage} setCurrentPostmanUsage={setCurrentPostmanUsage} postmanPlan={postmanPlan} setPostmanPlan={setPostmanPlan} workspaceStrategy={workspaceStrategy} setWorkspaceStrategy={setWorkspaceStrategy} namingConvention={namingConvention} setNamingConvention={setNamingConvention} />}
        {step === 3 && <StepServices services={services} addService={addService} removeService={removeService} duplicateService={duplicateService} updateService={updateService} deploymentTargets={deploymentTargets} setDeploymentTargets={setDeploymentTargets} />}
        {step === 4 && <StepGovernance governanceStages={governanceStages} setGovernanceStages={setGovernanceStages} governanceRules={governanceRules} setGovernanceRules={setGovernanceRules} governanceGroupScope={governanceGroupScope} setGovernanceGroupScope={setGovernanceGroupScope} notes={notes} setNotes={setNotes} />}
        {step === 5 && <StepBackfill backfill={backfill} setBackfill={setBackfill} gateway={gateway} />}
        {step === 6 && <StepReview companyName={companyName} primaryDomain={primaryDomain} scm={scm} ciCd={ciCd} gateway={gateway} cloud={cloud} idp={idp} secretManager={secretManager} devPortal={devPortal} monitoring={monitoring} specHosting={specHosting} observability={observability} postmanPlan={postmanPlan} workspaceStrategy={workspaceStrategy} namingConvention={namingConvention} services={services} deploymentTargets={deploymentTargets} governanceStages={governanceStages} governanceRules={governanceRules} backfill={backfill} discovery={discovery} projectName={projects.find((p) => p.id === projectId)?.name ?? ""} onEditStep={setStep} />}
      </div>

      {/* Error */}
      {result?.error && (
        <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
          {result.error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground-muted)" }}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30"
            style={{
              background: canAdvance() ? `linear-gradient(135deg, ${POSTMAN_ORANGE}, #e5593a)` : "rgba(255,255,255,0.04)",
              color: canAdvance() ? "#fff" : "var(--foreground-dim)",
              boxShadow: canAdvance() ? `0 0 20px ${POSTMAN_ORANGE}30` : "none",
            }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-8 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${POSTMAN_ORANGE}, #e5593a)`, color: "#fff", boxShadow: `0 0 30px ${POSTMAN_ORANGE}30` }}
          >
            {isPending ? "Mapping Architecture..." : "Submit & Map Architecture"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Shared UI ─────────────────────────────────────────────────────────── */

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--foreground)" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>{subtitle}</p>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium mb-1.5 block" style={{ color: "var(--foreground-muted)" }}>
        {label}{required && <span style={{ color: POSTMAN_ORANGE }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; onEnter?: () => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground)" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = `${POSTMAN_ORANGE}50`; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
      onKeyDown={onEnter ? (e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } } : undefined}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all appearance-none"
      style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        color: value ? "var(--foreground)" : "var(--foreground-dim)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = `${POSTMAN_ORANGE}50`; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      <option value="">{placeholder ?? "Select..."}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: selected ? `${POSTMAN_ORANGE}15` : "rgba(255,255,255,0.03)", border: `1px solid ${selected ? `${POSTMAN_ORANGE}40` : "rgba(255,255,255,0.08)"}`, color: selected ? POSTMAN_ORANGE : "var(--foreground-muted)" }}>
      {selected && <span className="mr-1">✓</span>}{label}
    </button>
  );
}

function InfoCallout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: `${POSTMAN_ORANGE}08`, border: `1px solid ${POSTMAN_ORANGE}20` }}>
      <p className="text-xs font-semibold mb-1" style={{ color: POSTMAN_ORANGE }}>{title}</p>
      <div className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>{children}</div>
    </div>
  );
}

function CollapsibleRef({ title, color = "var(--foreground-dim)", defaultOpen = false, children }: { title: string; color?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid rgba(255,255,255,0.06)` }}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        style={{ background: "rgba(255,255,255,0.02)" }}>
        <p className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color }}>{title}</p>
        <svg className="w-3.5 h-3.5 transition-transform" style={{ color: "var(--foreground-dim)", transform: open ? "rotate(180deg)" : "rotate(0)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && <div className="px-4 pb-4 pt-2" style={{ background: "rgba(255,255,255,0.01)" }}>{children}</div>}
    </div>
  );
}

function IntegrationHint({ fieldKey }: { fieldKey: string }) {
  const meta = INFRA_INTEGRATION_MAP[fieldKey];
  if (!meta) return null;
  return (
    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: `${POSTMAN_ORANGE}aa` }}>
      <span className="font-semibold">Postman:</span> {meta.integration}
    </p>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground)" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = `${POSTMAN_ORANGE}50`; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
  );
}

/* ─── Step 0: Project ───────────────────────────────────────────────────── */

function StepProject({ projectId, setProjectId, projects, companyName, setCompanyName, primaryDomain, setPrimaryDomain, discovery, setDiscovery }: {
  projectId: string; setProjectId: (v: string) => void; projects: Props["projects"];
  companyName: string; setCompanyName: (v: string) => void; primaryDomain: string; setPrimaryDomain: (v: string) => void;
  discovery: DiscoveryAnswers; setDiscovery: (v: DiscoveryAnswers) => void;
}) {
  const updateDiscovery = <K extends keyof DiscoveryAnswers>(key: K, value: DiscoveryAnswers[K]) => {
    setDiscovery({ ...discovery, [key]: value });
  };
  return (
    <>
      <SectionHeading title="Project & Discovery" subtitle="Assign this map to a project and capture key discovery insights from the call." />
      <div className="space-y-4 mb-6">
        <Field label="Project" required>
          <select value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              const proj = projects.find((p) => p.id === e.target.value);
              if (proj && !companyName) setCompanyName(proj.name);
              if (proj?.primaryDomain && !primaryDomain) setPrimaryDomain(proj.primaryDomain);
            }}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground)", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.primaryDomain ? ` (${p.primaryDomain})` : ""} — S{p.engagementStage}</option>)}
          </select>
        </Field>
        <Field label="Customer / Company Name" required><TextInput value={companyName} onChange={setCompanyName} placeholder="e.g. Acme Corp" /></Field>
        <Field label="Primary Domain"><TextInput value={primaryDomain} onChange={setPrimaryDomain} placeholder="e.g. acme.com" /></Field>
      </div>

      {/* Discovery Call Guide */}
      <div className="rounded-xl p-5 mb-6" style={{ background: `${POSTMAN_ORANGE}06`, border: `1px solid ${POSTMAN_ORANGE}15` }}>
        <p className="text-xs font-semibold mb-1" style={{ color: POSTMAN_ORANGE }}>Discovery Call Guide</p>
        <p className="text-[10px] mb-4" style={{ color: "var(--foreground-dim)" }}>
          Run this as a reverse demo — the customer shows their workflow, not us. Ask: &quot;Can you walk us through the end-to-end workflow for a developer who needs to build a new service?&quot;
        </p>

        <div className="space-y-4">
          <Field label="How does a developer provision a new service?">
            <TextArea value={discovery.provisioningFlow} onChange={(v) => updateDiscovery("provisioningFlow", v)}
              placeholder="Where do they start? (IDP portal, Jira ticket, architecture review?) What gets provisioned automatically? (repo, pipeline, infrastructure, environments?)" rows={3} />
          </Field>
          <Field label="Where do API specs live today?">
            <TextArea value={discovery.specLocation} onChange={(v) => updateDiscovery("specLocation", v)}
              placeholder="SwaggerHub, Spec Hub, Git repo, Confluence, nowhere? What templates or boilerplate do developers start from?" rows={2} />
          </Field>
          <Field label="Is there a system of record for all deployed APIs?">
            <TextArea value={discovery.catalogSystem} onChange={(v) => updateDiscovery("catalogSystem", v)}
              placeholder="Can a platform engineering leader answer: 'How many APIs do we have and what's their health?' When a developer needs to consume an internal API, how do they find it?" rows={2} />
          </Field>
          <Field label="How are secrets and credentials handled?">
            <TextArea value={discovery.secretHandling} onChange={(v) => updateDiscovery("secretHandling", v)}
              placeholder="Secret manager, hardcoded, environment variables? Are developers storing secrets directly in Postman collections?" rows={2} />
          </Field>
          <Field label="Ideal stakeholder for this engagement">
            <TextInput value={discovery.idealStakeholder} onChange={(v) => updateDiscovery("idealStakeholder", v)}
              placeholder="e.g. VP Platform Engineering, Director of Developer Experience, API Architecture Lead" />
          </Field>
          <Field label="POC target pipeline">
            <TextInput value={discovery.pocTarget} onChange={(v) => updateDiscovery("pocTarget", v)}
              placeholder="e.g. Python/Lambda, Node/Lambda — pick lowest LOE for first proof-of-value" />
          </Field>
        </div>
      </div>

      {/* Pain Points */}
      <div className="mb-6">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Identified Pain Points</p>
        <div className="flex flex-wrap gap-2">
          {PAIN_POINTS.map((pain) => (
            <Chip key={pain} label={pain} selected={discovery.painPoints.includes(pain)}
              onClick={() => updateDiscovery("painPoints", discovery.painPoints.includes(pain) ? discovery.painPoints.filter((p) => p !== pain) : [...discovery.painPoints, pain])} />
          ))}
        </div>
      </div>

      {/* LPL Reference Template */}
      <ReferenceTemplate />
    </>
  );
}

/* ─── Reference Template (collapsible) ──────────────────────────────────── */

function ReferenceTemplate() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3 text-left">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>★</div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "#a78bfa" }}>Reference: LPL Financial Template</p>
            <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>1,200+ Postman users &middot; Wealth management &middot; One call → full architecture map</p>
          </div>
        </div>
        <svg className="w-4 h-4 transition-transform" style={{ color: "#a78bfa", transform: open ? "rotate(180deg)" : "rotate(0)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* Customer profile */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>Customer Profile</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                ["IDP", "Brave Platform (internal)"],
                ["Cloud", "AWS (Lambda, EKS)"],
                ["CI/CD", "GitHub Actions, Octopus Deploy"],
                ["Security", "SonarQube, Wiz, Arnica"],
                ["Gateway", "Kong API Gateway"],
                ["Spec Hosting", "SwaggerHub"],
              ].map(([label, value]) => (
                <div key={label} className="px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <p className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>{label}</p>
                  <p className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>{value}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2" style={{ color: "var(--foreground-dim)" }}>
              Stakeholder: <strong style={{ color: "var(--foreground)" }}>Komal Sutaria</strong>, VP Developer Experience &amp; App Modernization
            </p>
          </div>

          {/* What we did */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>What We Did in One Call</p>
            <div className="space-y-1">
              {[
                "Ran a reverse demo — LPL walked us through Brave end-to-end",
                "Identified six integration points on their infrastructure diagram",
                "Proposed the full automation architecture on the call",
                "Built internal POC same day",
                "Agreed on Python/Lambda as the target template for POC",
                "Scheduled follow-up with DevOps team for the following week",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[7px] font-bold" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>✓</div>
                  <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What it solves */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>What This Immediately Solves</p>
            <div className="flex flex-wrap gap-1.5">
              {["No API catalog", "No secrets/variables inventory", "No automated smoke & contract tests", "Manual Postman resource creation", "Spinning up non-functional dev services"].map((s) => (
                <span key={s} className="px-2 py-0.5 rounded text-[9px]" style={{ background: "rgba(239,68,68,0.06)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.08)" }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Key quote */}
          <div className="rounded-lg px-4 py-3" style={{ background: "rgba(139,92,246,0.06)", borderLeft: "3px solid #8b5cf6" }}>
            <p className="text-[11px] italic" style={{ color: "var(--foreground)" }}>
              &quot;If I achieve [secret manager integration], I think it would be my dream come true for 2026.&quot;
            </p>
            <p className="text-[9px] mt-1" style={{ color: "var(--foreground-dim)" }}>— Komal Sutaria, VP Developer Experience, LPL Financial</p>
          </div>

          {/* Impact */}
          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.10)" }}>
            <p className="text-[10px]" style={{ color: "#86efac" }}>
              <strong style={{ color: "#22c55e" }}>High-leverage:</strong> One CSE engagement (11-18 hrs over 2-4 weeks) produces an integration that serves 1,000+ developers and embeds Postman into core infrastructure permanently.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 1: Infrastructure ────────────────────────────────────────────── */

function OtherSpecify({ fieldKey, value, otherSpecs, setOtherSpecs }: { fieldKey: string; value: string; otherSpecs: Record<string, string>; setOtherSpecs: (v: Record<string, string>) => void }) {
  if (value !== "Other") return null;
  return (
    <div className="mt-1.5">
      <TextInput value={otherSpecs[fieldKey] ?? ""} onChange={(v) => setOtherSpecs({ ...otherSpecs, [fieldKey]: v })} placeholder="Please specify..." />
    </div>
  );
}

function StepInfrastructure({ scm, setScm, ciCd, setCiCd, gateway, setGateway, cloud, setCloud, idp, setIdp, secretManager, setSecretManager, devPortal, setDevPortal, monitoring, setMonitoring, specHosting, setSpecHosting, observability, setObservability, otherSpecs, setOtherSpecs }: {
  scm: string; setScm: (v: string) => void; ciCd: string; setCiCd: (v: string) => void;
  gateway: string; setGateway: (v: string) => void; cloud: string; setCloud: (v: string) => void;
  idp: string; setIdp: (v: string) => void; secretManager: string; setSecretManager: (v: string) => void;
  devPortal: string; setDevPortal: (v: string) => void; monitoring: string; setMonitoring: (v: string) => void;
  specHosting: string; setSpecHosting: (v: string) => void; observability: string; setObservability: (v: string) => void;
  otherSpecs: Record<string, string>; setOtherSpecs: (v: Record<string, string>) => void;
}) {
  return (
    <>
      <SectionHeading title="Customer Infrastructure" subtitle="Map out the customer's current technology stack. Each selection shows how Postman integrates." />
      <InfoCallout title="Integration Architecture">
        Each infrastructure layer maps directly to a Postman integration point. As you fill in each component, the integration strategy is shown below the selection.
      </InfoCallout>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <Field label="Source Control (SCM)" required><SelectInput value={scm} onChange={setScm} options={SCM_OPTIONS} placeholder="Select SCM..." /></Field>
          <OtherSpecify fieldKey="scm" value={scm} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
          {scm && <IntegrationHint fieldKey="scm" />}
        </div>
        <div>
          <Field label="CI/CD Platform" required><SelectInput value={ciCd} onChange={setCiCd} options={CICD_OPTIONS} placeholder="Select CI/CD..." /></Field>
          <OtherSpecify fieldKey="ciCd" value={ciCd} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
          {ciCd && <IntegrationHint fieldKey="ciCd" />}
        </div>
        <div>
          <Field label="API Gateway"><SelectInput value={gateway} onChange={setGateway} options={GATEWAY_OPTIONS} placeholder="Select gateway..." /></Field>
          {gateway && gateway !== "None" && <IntegrationHint fieldKey="gateway" />}
          {gateway === "Kong" && (
            <div className="mt-1.5 rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#fca5a5" }}>
              <strong style={{ color: "#ef4444" }}>Kong:</strong> No gateway app exists for Kong. Use the CI/CD provisioning approach in this playbook as the workaround. Do not promise gateway import.
            </div>
          )}
        </div>
        <div>
          <Field label="Cloud Provider" required><SelectInput value={cloud} onChange={setCloud} options={CLOUD_OPTIONS} placeholder="Select cloud..." /></Field>
          <OtherSpecify fieldKey="cloud" value={cloud} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
        </div>
        <div>
          <Field label="Internal Developer Platform (IDP)"><SelectInput value={idp} onChange={setIdp} options={IDP_OPTIONS} placeholder="Select IDP..." /></Field>
          {idp && idp !== "None" && <IntegrationHint fieldKey="idp" />}
        </div>
        <div>
          <Field label="Secret Manager"><SelectInput value={secretManager} onChange={setSecretManager} options={SECRET_OPTIONS} placeholder="Select secret manager..." /></Field>
          <OtherSpecify fieldKey="secretManager" value={secretManager} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
          {secretManager && secretManager !== "Environment Variables" && <IntegrationHint fieldKey="secretManager" />}
        </div>
        <div>
          <Field label="Spec Hosting"><SelectInput value={specHosting} onChange={setSpecHosting} options={SPEC_HOSTING_OPTIONS} placeholder="Select spec hosting..." /></Field>
          <OtherSpecify fieldKey="specHosting" value={specHosting} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
          {specHosting && specHosting !== "None" && <IntegrationHint fieldKey="specHosting" />}
        </div>
        <div>
          <Field label="Developer Portal"><TextInput value={devPortal} onChange={setDevPortal} placeholder="e.g. Backstage, Port, Cortex" /></Field>
        </div>
        <div>
          <Field label="Monitoring / Alerting"><SelectInput value={monitoring} onChange={setMonitoring} options={MONITORING_OPTIONS} placeholder="Select monitoring..." /></Field>
          <OtherSpecify fieldKey="monitoring" value={monitoring} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
          {monitoring && monitoring !== "None" && <IntegrationHint fieldKey="monitoring" />}
        </div>
        <div>
          <Field label="Observability (APM / Tracing)"><SelectInput value={observability} onChange={setObservability} options={OBSERVABILITY_OPTIONS} placeholder="Select observability..." /></Field>
          <OtherSpecify fieldKey="observability" value={observability} otherSpecs={otherSpecs} setOtherSpecs={setOtherSpecs} />
          {observability && observability !== "None" && <IntegrationHint fieldKey="observability" />}
        </div>
      </div>

      {/* API Catalog context — collapsible */}
      <div className="mt-6 space-y-3">
        <CollapsibleRef title="API Catalog — Available in v11" color="#22c55e">
          <p className="text-[10px] mb-3" style={{ color: "var(--foreground-dim)" }}>
            Service-level inventory backed by code as ground truth. One workspace = one repo. Aggregates health metrics, governance scoring, and ownership — all queryable via Agent Mode.
          </p>
          <p className="text-[10px] font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>Four ingestion mechanisms:</p>
          <div className="space-y-1 mb-3">
            {[
              { num: "1", text: "Repo-linked workspaces — workspace with filesystem / git integration enabled (baseline)" },
              { num: "2", text: "API Gateway apps — import from AWS, Azure, Apigee, IBM gateways directly" },
              { num: "3", text: "Insights Agent — runtime traffic analysis discovers endpoints and shadow APIs" },
              { num: "4", text: "Discovery APIs — programmatic bulk import (coming soon; enables Backstage/CMDB integration)" },
            ].map((m) => (
              <div key={m.num} className="flex items-start gap-2">
                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[7px] font-bold"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>{m.num}</div>
                <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{m.text}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.12)" }}>
            <strong style={{ color: "#eab308" }}>Critical:</strong>{" "}
            <span style={{ color: "#fde68a" }}>API Governance has moved into API Catalog as &quot;Governance Groups.&quot; Workspaces must be project-linked (repo linked via filesystem) to appear in catalog. Agent Mode can query the catalog but cannot yet fix issues it finds.</span>
          </div>
        </CollapsibleRef>

        <CollapsibleRef title="End-to-End Provisioning Flow" color={POSTMAN_ORANGE}>
          <div className="space-y-1">
            {[
              "Developer requests new service in IDP",
              "IDP provisions infrastructure (repo, pipeline, cloud environment)",
              "IDP triggers Postman provisioning (via API or GitHub Action)",
              "Create workspace → Link to repo → Import spec → Generate collections",
              "Create environments (per target) → Wire secret manager → Configure monitors",
              "Service appears in API Catalog automatically",
              "On every code push: CLI runs tests → Spec syncs → Results feed catalog → Governance validates",
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px] font-bold"
                  style={{ background: `${POSTMAN_ORANGE}15`, color: POSTMAN_ORANGE, border: `1px solid ${POSTMAN_ORANGE}25` }}>{i + 1}</div>
                <p className="text-[11px]" style={{ color: "var(--foreground-muted)" }}>{line}</p>
              </div>
            ))}
          </div>
        </CollapsibleRef>
      </div>
    </>
  );
}

/* ─── Step 2: Postman Strategy ──────────────────────────────────────────── */

function StepPostman({ currentPostmanUsage, setCurrentPostmanUsage, postmanPlan, setPostmanPlan, workspaceStrategy, setWorkspaceStrategy, namingConvention, setNamingConvention }: {
  currentPostmanUsage: string; setCurrentPostmanUsage: (v: string) => void; postmanPlan: string; setPostmanPlan: (v: string) => void;
  workspaceStrategy: string; setWorkspaceStrategy: (v: string) => void; namingConvention: string; setNamingConvention: (v: string) => void;
}) {
  return (
    <>
      <SectionHeading title="Postman Strategy" subtitle="Define how Postman maps onto the customer's ecosystem." />
      <InfoCallout title="Core Principle: One Service = One Workspace = One Repo">
        Each microservice/API gets its own Postman workspace linked to its Git repo.
        The workspace becomes the single source of truth for that service&apos;s API lifecycle —
        spec, collections, tests, environments, and monitors.
      </InfoCallout>

      {/* Mapping table */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "var(--foreground-dim)" }}>Architecture Mapping</p>
        <div className="space-y-1.5">
          {[
            ["Git repository", "One microservice or API", "Customer's SCM"],
            ["Postman workspace", "One service", "Provisioning automation (IDP integration)"],
            ["API Catalog entry", "One service", "Automatic — workspace with repo link appears in catalog"],
            ["System environment", "One deployment target", "Postman environments within the workspace"],
          ].map(([layer, mapsTo, enforcedBy]) => (
            <div key={layer} className="grid grid-cols-3 gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-[11px] font-medium" style={{ color: POSTMAN_ORANGE }}>{layer}</p>
              <p className="text-[11px]" style={{ color: "var(--foreground)" }}>{mapsTo}</p>
              <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{enforcedBy}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Current Postman Usage">
          <TextArea value={currentPostmanUsage} onChange={setCurrentPostmanUsage} placeholder="e.g. Ad-hoc usage by a few developers, no formal workspace structure, ~50 collections scattered across personal workspaces..." />
        </Field>
        <Field label="Postman Plan" required>
          <SelectInput value={postmanPlan} onChange={setPostmanPlan} options={POSTMAN_PLANS} placeholder="Select plan..." />
        </Field>
        <Field label="Workspace Strategy" required>
          <SelectInput value={workspaceStrategy} onChange={setWorkspaceStrategy}
            options={["One workspace per service", "One workspace per domain", "One workspace per team", "Shared workspaces (current)"]}
            placeholder="Select strategy..." />
        </Field>
        <Field label="Naming Convention">
          <TextInput value={namingConvention} onChange={setNamingConvention} placeholder="[domain]-[service]-[purpose]" />
        </Field>
        <div className="space-y-3 mt-4">
          <CollapsibleRef title="Workspace Contents (Standard Template)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ["API Spec (OpenAPI/AsyncAPI/Proto)", "Source of truth for the contract", true],
                ["Baseline Collection (from spec)", "Registered endpoints with docs", true],
                ["Smoke Test Collection", "Validates expected status codes", true],
                ["Contract Test Collection", "Validates response schemas match spec", true],
                ["Environments (per target)", "Variables for dev/QA/staging/prod", true],
                ["Pre-request Scripts", "Resolves credentials from secret manager", true],
                ["Monitor (on smoke tests)", "24/7 health checking → catalog Monitor tab", false],
                ["README / Workspace Overview", "Onboarding guide for the service", true],
              ].map(([artifact, purpose, req]) => (
                <div key={artifact as string} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: req ? POSTMAN_ORANGE : "var(--foreground-dim)" }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {artifact as string}
                      {req && <span className="text-[9px] ml-1 font-normal" style={{ color: POSTMAN_ORANGE }}>Required</span>}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{purpose as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleRef>

          <CollapsibleRef title="At Provisioning Time — When IDP creates a new service" color={POSTMAN_ORANGE}>
            <div className="space-y-1">
              {[
                ["Workspace creation", "Auto-create workspace named per convention", "Postman API: POST /workspaces"],
                ["Repo linkage", "Link workspace to new repo", "Git integration / workspace metadata"],
                ["Spec import", "Import API spec from SwaggerHub/Spec Hub/repo", "Postman API or CLI: postman api import"],
                ["Collection gen", "Generate baseline collections from spec", "Postman API: collection from schema"],
                ["Test gen", "Auto-generate smoke & contract tests", "Package Library templates or Agent Mode"],
                ["Environment creation", "Populate envs with invoke URLs, account IDs", "Postman API: POST /environments"],
                ["Secret references", "Wire pre-request scripts to secret manager", "Pre-request script templates (AWS SDK / Vault SDK)"],
                ["Catalog setup", "Enable repo linking + system env mapping + project linking", "Automation must handle — zero developer action"],
              ].map(([step, what, how]) => (
                <div key={step} className="grid grid-cols-[100px_1fr_1fr] gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <p className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>{step}</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{what}</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{how}</p>
                </div>
              ))}
            </div>
          </CollapsibleRef>

          <CollapsibleRef title="At CI/CD Time — When developer pushes code" color="#3b82f6">
            <div className="space-y-1">
              {[
                ["Pre-deploy tests", "Smoke + contract tests against built container", "GitHub Action / pipeline job using Postman CLI"],
                ["Post-deploy tests", "Smoke + contract tests against deployed service", "Same CLI job, different environment"],
                ["Sync update", "Update collections/environments if spec changed", "GitHub Action triggered on spec file change"],
                ["Results reporting", "Report test results to API Catalog metrics", "Postman CLI reporter + API Catalog integration"],
              ].map(([step, what, how]) => (
                <div key={step} className="grid grid-cols-[100px_1fr_1fr] gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <p className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>{step}</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{what}</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{how}</p>
                </div>
              ))}
            </div>
          </CollapsibleRef>

          <CollapsibleRef title="API Catalog Setup — Required per workspace" color="#22c55e">
            <div className="space-y-1 mb-3">
              {[
                ["Enable filesystem / repo linking", "Workspaces without repo linking do not appear in API Catalog. #1 gotcha."],
                ["Configure system environment mapping", "Maps dev/QA/staging/prod to catalog's system environment concept. Determines metric segmentation."],
                ["Set up project linking", "Required for Monitor tab data. Without project linking, monitor results don't flow into catalog."],
                ["Apply workspace tags", "Helps catalog filtering and team-level views. Use customer's naming convention."],
              ].map(([step, why]) => (
                <div key={step} className="flex items-start gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#22c55e" }} />
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: "var(--foreground)" }}>{step}</p>
                    <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{why}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg px-3 py-2 text-[10px]" style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.12)" }}>
              <strong style={{ color: "#eab308" }}>Do not rely on developers to do these steps manually.</strong>{" "}
              <span style={{ color: "#fde68a" }}>The automation should handle all of this at provisioning time so the service appears in the catalog immediately with zero developer action.</span>
            </div>
          </CollapsibleRef>

          <CollapsibleRef title="What Platform Engineering Leaders See (API Catalog + Agent Mode)">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["Service count", "Collections", "Specs", "CI/CD activity", "Test pass rates", "Error rates", "Latency", "Governance compliance", "Ownership"].map((m) => (
                <span key={m} className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ background: "rgba(34,197,94,0.08)", color: "#86efac", border: "1px solid rgba(34,197,94,0.12)" }}>{m}</span>
              ))}
            </div>
            <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              Example queries: &quot;What&apos;s the health of our API estate?&quot; &middot; &quot;Which services have failing tests?&quot; &middot; &quot;Who owns the worst performing endpoints?&quot; &middot; &quot;How compliant are our APIs?&quot;
            </p>
          </CollapsibleRef>
        </div>
      </div>
    </>
  );
}

/* ─── Step 3: Services ──────────────────────────────────────────────────── */

function StepServices({ services, addService, removeService, duplicateService, updateService, deploymentTargets, setDeploymentTargets }: {
  services: ServiceEntry[]; addService: () => void; removeService: (i: number) => void; duplicateService: (i: number) => void;
  updateService: <K extends keyof ServiceEntry>(i: number, k: K, v: ServiceEntry[K]) => void;
  deploymentTargets: string[]; setDeploymentTargets: (v: string[]) => void;
}) {
  const [newTarget, setNewTarget] = useState("");
  return (
    <>
      <SectionHeading title="Service Constellation" subtitle="Map every service the customer operates. Each becomes a workspace in Postman." />
      <div className="mb-6">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Deployment Targets</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {deploymentTargets.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
              style={{ background: `${POSTMAN_ORANGE}12`, border: `1px solid ${POSTMAN_ORANGE}30`, color: POSTMAN_ORANGE }}>
              {t}
              <button type="button" onClick={() => setDeploymentTargets(deploymentTargets.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput value={newTarget} onChange={setNewTarget} placeholder="Add target (e.g. sandbox, perf)..."
            onEnter={() => { if (newTarget.trim()) { setDeploymentTargets([...deploymentTargets, newTarget.trim()]); setNewTarget(""); } }} />
          <button type="button" onClick={() => { if (newTarget.trim()) { setDeploymentTargets([...deploymentTargets, newTarget.trim()]); setNewTarget(""); } }}
            className="px-4 py-2 rounded-lg text-xs font-medium flex-shrink-0" style={{ background: `${POSTMAN_ORANGE}15`, border: `1px solid ${POSTMAN_ORANGE}30`, color: POSTMAN_ORANGE }}>Add</button>
        </div>
      </div>
      <div className="space-y-4">
        {services.map((svc, idx) => (
          <div key={idx} className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                  style={{ background: `${POSTMAN_ORANGE}15`, color: POSTMAN_ORANGE, border: `1px solid ${POSTMAN_ORANGE}30` }}>{idx + 1}</div>
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {svc.domain && svc.name ? `${svc.domain}/${svc.name}` : `Service ${idx + 1}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => duplicateService(idx)} className="text-xs px-2 py-1 rounded" style={{ color: "#60a5fa" }}>Duplicate</button>
                {services.length > 1 && <button type="button" onClick={() => removeService(idx)} className="text-xs px-2 py-1 rounded" style={{ color: "#f87171" }}>Remove</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Domain" required><TextInput value={svc.domain} onChange={(v) => updateService(idx, "domain", v)} placeholder="e.g. payments" /></Field>
              <Field label="Service Name" required><TextInput value={svc.name} onChange={(v) => updateService(idx, "name", v)} placeholder="e.g. checkout-api" /></Field>
              <Field label="Purpose"><TextInput value={svc.purpose} onChange={(v) => updateService(idx, "purpose", v)} placeholder="e.g. Handles payment processing" /></Field>
              <Field label="API Type"><SelectInput value={svc.type} onChange={(v) => updateService(idx, "type", v as ServiceEntry["type"])} options={API_TYPES} /></Field>
              <Field label="Git Repository"><TextInput value={svc.repo} onChange={(v) => updateService(idx, "repo", v)} placeholder="e.g. github.com/acme/checkout-api" /></Field>
              <Field label="Owner / Team"><TextInput value={svc.owner} onChange={(v) => updateService(idx, "owner", v)} placeholder="e.g. Platform Team" /></Field>
              <Field label="Spec Format"><SelectInput value={svc.specFormat} onChange={(v) => updateService(idx, "specFormat", v)} options={SPEC_FORMATS} /></Field>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={svc.hasSpec} onChange={(e) => updateService(idx, "hasSpec", e.target.checked)} className="accent-[#FF6C37]" />
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Has API Spec</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={svc.ciCdIntegrated} onChange={(e) => updateService(idx, "ciCdIntegrated", e.target.checked)} className="accent-[#FF6C37]" />
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>CI/CD Integrated</span>
                </label>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--foreground-dim)" }}>Environments</p>
              <div className="flex flex-wrap gap-1.5">
                {deploymentTargets.map((env) => (
                  <Chip key={env} label={env} selected={svc.environments.includes(env)} onClick={() => {
                    const next = svc.environments.includes(env) ? svc.environments.filter((e) => e !== env) : [...svc.environments, env];
                    updateService(idx, "environments", next);
                  }} />
                ))}
              </div>
            </div>
            {/* Catalog Readiness */}
            <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.08)" }}>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#22c55e" }}>Catalog Readiness</p>
              <div className="flex flex-wrap gap-3 mb-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={svc.hasWorkspace} onChange={(e) => updateService(idx, "hasWorkspace", e.target.checked)} className="accent-[#22c55e]" />
                  <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Has Workspace</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={svc.repoLinked} onChange={(e) => updateService(idx, "repoLinked", e.target.checked)} className="accent-[#22c55e]" />
                  <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Repo Linked</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={svc.inCatalog} onChange={(e) => updateService(idx, "inCatalog", e.target.checked)} className="accent-[#22c55e]" />
                  <span className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>In Catalog</span>
                </label>
              </div>
              <Field label="Ingestion Path">
                <SelectInput value={svc.catalogIngestion} onChange={(v) => updateService(idx, "catalogIngestion", v as ServiceEntry["catalogIngestion"])}
                  options={["provisioned", "gateway", "insights", "migration", "manual"]} placeholder="How will this service enter the catalog?" />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addService} className="w-full mt-4 py-3 rounded-xl text-sm font-medium transition-all"
        style={{ background: `${POSTMAN_ORANGE}08`, border: `1px dashed ${POSTMAN_ORANGE}30`, color: POSTMAN_ORANGE }}>+ Add Service</button>
    </>
  );
}

/* ─── Step 4: Governance Architecture ───────────────────────────────────── */

function StepGovernance({ governanceStages, setGovernanceStages, governanceRules, setGovernanceRules, governanceGroupScope, setGovernanceGroupScope, notes, setNotes }: {
  governanceStages: GovernanceStage[]; setGovernanceStages: (v: GovernanceStage[]) => void;
  governanceRules: string[]; setGovernanceRules: (v: string[]) => void;
  governanceGroupScope: string; setGovernanceGroupScope: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  const [customRule, setCustomRule] = useState("");
  const [stageRuleInputs, setStageRuleInputs] = useState<Record<string, string>>({});
  const toggleStage = (stage: string) => {
    setGovernanceStages(governanceStages.map((g) => g.stage === stage ? { ...g, enabled: !g.enabled } : g));
  };
  const toggleStageRule = (stage: string, rule: string) => {
    setGovernanceStages(governanceStages.map((g) => {
      if (g.stage !== stage) return g;
      const rules = g.rules.includes(rule) ? g.rules.filter((r) => r !== rule) : [...g.rules, rule];
      return { ...g, rules };
    }));
  };
  const addStageRule = (stage: string) => {
    const value = stageRuleInputs[stage]?.trim();
    if (!value) return;
    setGovernanceStages(governanceStages.map((g) => g.stage === stage ? { ...g, rules: [...g.rules, value] } : g));
    setStageRuleInputs((prev) => ({ ...prev, [stage]: "" }));
  };

  return (
    <>
      <SectionHeading title="Governance Architecture" subtitle="Governance is not a separate step — it's embedded in the architecture." />
      <InfoCallout title="Governance Groups (API Catalog)">
        Governance rules are organized as Governance Groups inside API Catalog. Platform engineering leaders see governance compliance
        alongside health metrics in the same view. Rules can be scoped to specific services, teams, or the entire organization.
        Agent Mode can query governance compliance conversationally.
      </InfoCallout>

      {/* Governance stages */}
      <div className="space-y-4 mb-6">
        {governanceStages.map((gs) => {
          const meta = GOVERNANCE_STAGE_META[gs.stage];
          return (
            <div key={gs.stage} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${gs.enabled ? `${meta.color}30` : "rgba(255,255,255,0.06)"}` }}>
              <button type="button" onClick={() => toggleStage(gs.stage)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                style={{ background: gs.enabled ? `${meta.color}08` : "rgba(255,255,255,0.02)" }}>
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px]"
                  style={{ background: gs.enabled ? `${meta.color}20` : "rgba(255,255,255,0.04)", color: gs.enabled ? meta.color : "var(--foreground-dim)", border: `1px solid ${gs.enabled ? `${meta.color}40` : "rgba(255,255,255,0.08)"}` }}>
                  {gs.enabled ? "✓" : ""}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: gs.enabled ? meta.color : "var(--foreground-muted)" }}>{meta.title}</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{meta.subtitle}</p>
                </div>
              </button>
              {gs.enabled && (
                <div className="px-4 pb-4 pt-2 space-y-2" style={{ background: `${meta.color}04` }}>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_GOVERNANCE_STAGES.find((d) => d.stage === gs.stage)?.rules.map((rule) => (
                      <Chip key={rule} label={rule} selected={gs.rules.includes(rule)} onClick={() => toggleStageRule(gs.stage, rule)} />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <TextInput value={stageRuleInputs[gs.stage] ?? ""} onChange={(v) => setStageRuleInputs((prev) => ({ ...prev, [gs.stage]: v }))}
                      placeholder={`Add custom ${meta.title.toLowerCase()} rule...`} onEnter={() => addStageRule(gs.stage)} />
                    <button type="button" className="px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0"
                      style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30`, color: meta.color }}
                      onClick={() => addStageRule(gs.stage)}>Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Governance Group Scope */}
      <Field label="Governance Group Scope">
        <SelectInput value={governanceGroupScope} onChange={setGovernanceGroupScope}
          options={["All services (organization-wide)", "Per domain", "Per team", "Per service"]}
          placeholder="How are governance rules scoped?" />
      </Field>

      {/* Additional custom rules */}
      <div className="mt-6 mb-6">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>Additional Custom Rules</p>
        <div className="flex gap-2">
          <TextInput value={customRule} onChange={setCustomRule} placeholder="Add custom governance rule..."
            onEnter={() => { if (customRule.trim()) { setGovernanceRules([...governanceRules, customRule.trim()]); setCustomRule(""); } }} />
          <button type="button" onClick={() => { if (customRule.trim()) { setGovernanceRules([...governanceRules, customRule.trim()]); setCustomRule(""); } }}
            className="px-4 py-2 rounded-lg text-xs font-medium flex-shrink-0" style={{ background: `${POSTMAN_ORANGE}15`, border: `1px solid ${POSTMAN_ORANGE}30`, color: POSTMAN_ORANGE }}>Add</button>
        </div>
        {governanceRules.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {governanceRules.map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground-muted)" }}>
                {r}
                <button type="button" onClick={() => setGovernanceRules(governanceRules.filter((x) => x !== r))} className="opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Field label="Additional Notes / Call Context">
        <TextArea value={notes} onChange={setNotes} placeholder="Capture anything else from the discovery call — blockers, stakeholder concerns, timeline pressure, competitive context..." rows={5} />
      </Field>
    </>
  );
}

/* ─── Step 5: Backfill Strategy ─────────────────────────────────────────── */

function StepBackfill({ backfill, setBackfill, gateway }: {
  backfill: BackfillStrategy; setBackfill: (v: BackfillStrategy) => void; gateway: string;
}) {
  const update = <K extends keyof BackfillStrategy>(key: K, value: BackfillStrategy[K]) => {
    setBackfill({ ...backfill, [key]: value });
  };

  const METHODS: Array<{ key: keyof BackfillStrategy; label: string; desc: string; priority: string; color: string }> = [
    { key: "gatewayImport", label: "Gateway Import", desc: `Bulk-import deployed APIs from ${gateway || "API gateway"} with specs and environments. Fastest path.`, priority: "Priority 1 — Fastest", color: "#22c55e" },
    { key: "insightsAgent", label: "Insights Agent (Runtime Discovery)", desc: "Deploy Insights Agent to discover APIs from live traffic — catches shadow APIs that aren't documented anywhere.", priority: "Priority 2 — Shadow APIs", color: "#3b82f6" },
    { key: "workspaceMigration", label: "Workspace Migration", desc: "For APIs already in Postman but not repo-linked: enable filesystem integration and tag workspaces for catalog.", priority: "Priority 3 — Existing Postman", color: "#8b5cf6" },
    { key: "cliBatchImport", label: "CLI Batch Import", desc: "For APIs with specs in repos but not in Postman: use Postman CLI to batch-import specs and generate collections.", priority: "Priority 4 — Specs in Repos", color: POSTMAN_ORANGE },
    { key: "manual", label: "Manual (Agent Mode)", desc: "For APIs with no spec and no Postman presence: create workspace and spec manually. Agent Mode can generate specs from observed behavior.", priority: "Priority 5 — Last Resort", color: "#f59e0b" },
  ];

  return (
    <>
      <SectionHeading title="Backfill Strategy" subtitle="New services get provisioned automatically. But what about the existing APIs?" />
      <InfoCallout title="Why backfill matters">
        The architecture above handles new services automatically via IDP provisioning. But most customers have hundreds of existing APIs
        that need to be brought into the system. The backfill strategy determines how fast the customer reaches full catalog coverage.
      </InfoCallout>

      <div className="mb-6">
        <Field label="Estimated Existing APIs">
          <TextInput value={backfill.estimatedExistingApis} onChange={(v) => update("estimatedExistingApis", v)} placeholder="e.g. ~200 services, ~50 with specs" />
        </Field>
      </div>

      <p className="text-xs font-medium mb-3" style={{ color: "var(--foreground-muted)" }}>Backfill Methods (select all that apply)</p>
      <div className="space-y-3 mb-6">
        {METHODS.map((m) => (
          <button key={m.key} type="button" onClick={() => update(m.key, !backfill[m.key] as never)}
            className="w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all"
            style={{
              background: (backfill[m.key] as boolean) ? `${m.color}08` : "rgba(255,255,255,0.02)",
              border: `1px solid ${(backfill[m.key] as boolean) ? `${m.color}30` : "rgba(255,255,255,0.06)"}`,
            }}>
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
              style={{
                background: (backfill[m.key] as boolean) ? `${m.color}20` : "rgba(255,255,255,0.04)",
                color: (backfill[m.key] as boolean) ? m.color : "var(--foreground-dim)",
                border: `1px solid ${(backfill[m.key] as boolean) ? `${m.color}40` : "rgba(255,255,255,0.08)"}`,
              }}>
              {(backfill[m.key] as boolean) ? "✓" : ""}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: (backfill[m.key] as boolean) ? m.color : "var(--foreground-muted)" }}>{m.label}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${m.color}12`, color: m.color }}>{m.priority}</span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>{m.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <Field label="Backfill Notes">
        <TextArea value={backfill.backfillNotes} onChange={(v) => update("backfillNotes", v)}
          placeholder="Any context about the customer's existing API landscape — which systems have specs, which are shadow APIs, which teams own what..." rows={4} />
      </Field>
    </>
  );
}

/* ─── Step 6: Review & Submit ───────────────────────────────────────────── */

function StepReview({ companyName: _companyName, primaryDomain: _primaryDomain, scm, ciCd, gateway, cloud, idp, secretManager, devPortal, monitoring, specHosting, observability,
  postmanPlan, workspaceStrategy, namingConvention, services, deploymentTargets, governanceStages, governanceRules: _governanceRules, backfill, discovery, projectName, onEditStep }: {
  companyName: string; primaryDomain: string; scm: string; ciCd: string; gateway: string; cloud: string;
  idp: string; secretManager: string; devPortal: string; monitoring: string; specHosting: string; observability: string;
  postmanPlan: string; workspaceStrategy: string; namingConvention: string;
  services: ServiceEntry[]; deploymentTargets: string[];
  governanceStages: GovernanceStage[]; governanceRules: string[];
  backfill: BackfillStrategy; discovery: DiscoveryAnswers; projectName: string;
  onEditStep: (step: number) => void;
}) {
  const EditLink = ({ step, label = "Edit" }: { step: number; label?: string }) => (
    <button type="button" onClick={() => onEditStep(step)} className="text-[9px] font-medium" style={{ color: POSTMAN_ORANGE }}>{label} →</button>
  );
  const domains = [...new Set(services.map((s) => s.domain).filter(Boolean))];
  const activeGovStages = governanceStages.filter((g) => g.enabled);
  const backfillMethods = [
    backfill.gatewayImport && "Gateway Import",
    backfill.insightsAgent && "Insights Agent",
    backfill.workspaceMigration && "Workspace Migration",
    backfill.cliBatchImport && "CLI Batch Import",
    backfill.manual && "Manual (Agent Mode)",
  ].filter(Boolean);

  return (
    <>
      <SectionHeading title="Review Architecture Map" subtitle={`Submitting to project: ${projectName}`} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Services", value: services.length, color: POSTMAN_ORANGE },
          { label: "Domains", value: domains.length, color: "#8b5cf6" },
          { label: "Environments", value: deploymentTargets.length, color: "#06b6d4" },
          { label: "Gov Stages", value: activeGovStages.length, color: "#22c55e" },
          { label: "Backfill", value: backfillMethods.length, color: "#f59e0b" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl p-3 text-center" style={{ background: `${card.color}08`, border: `1px solid ${card.color}20` }}>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Infrastructure */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Infrastructure & Postman Integration</p>
          <EditLink step={1} />
        </div>
        <div className="space-y-1.5">
          {[
            ["SCM", scm, INFRA_INTEGRATION_MAP.scm?.integration],
            ["CI/CD", ciCd, INFRA_INTEGRATION_MAP.ciCd?.integration],
            ["Gateway", gateway || "N/A", gateway && gateway !== "None" ? INFRA_INTEGRATION_MAP.gateway?.integration : null],
            ["Cloud", cloud, null],
            ["IDP", idp || "N/A", idp && idp !== "None" ? INFRA_INTEGRATION_MAP.idp?.integration : null],
            ["Secrets", secretManager || "N/A", secretManager ? INFRA_INTEGRATION_MAP.secretManager?.integration : null],
            ["Portal", devPortal || "N/A", null],
            ["Monitoring", monitoring || "N/A", monitoring && monitoring !== "None" ? INFRA_INTEGRATION_MAP.monitoring?.integration : null],
            ["Spec Hosting", specHosting || "N/A", specHosting && specHosting !== "None" ? INFRA_INTEGRATION_MAP.specHosting?.integration : null],
            ["Observability", observability || "N/A", observability && observability !== "None" ? INFRA_INTEGRATION_MAP.observability?.integration : null],
          ].map(([label, value, integration]) => (
            <div key={label as string} className="grid grid-cols-3 gap-2 px-3 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.01)" }}>
              <p className="text-[10px] font-medium" style={{ color: "var(--foreground-dim)" }}>{label as string}</p>
              <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{value as string}</p>
              {integration && <p className="text-[9px]" style={{ color: `${POSTMAN_ORANGE}99` }}>{integration as string}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Postman */}
      <div className="rounded-xl p-4 mb-4" style={{ background: `${POSTMAN_ORANGE}06`, border: `1px solid ${POSTMAN_ORANGE}15` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: POSTMAN_ORANGE }}>Postman Strategy</p>
          <EditLink step={2} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div><p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Plan</p><p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{postmanPlan}</p></div>
          <div><p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Workspace Strategy</p><p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{workspaceStrategy}</p></div>
          <div><p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Naming</p><p className="text-xs font-medium font-mono" style={{ color: "var(--foreground)" }}>{namingConvention}</p></div>
        </div>
      </div>

      {/* Services */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Services ({services.length})</p>
          <EditLink step={3} />
        </div>
        <div className="space-y-2">
          {services.map((svc, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: POSTMAN_ORANGE }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{svc.domain}/{svc.name}<span className="font-normal ml-2" style={{ color: "var(--foreground-dim)" }}>({svc.type})</span></p>
                {svc.purpose && <p className="text-[10px] truncate" style={{ color: "var(--foreground-dim)" }}>{svc.purpose}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {svc.hasSpec && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>SPEC</span>}
                {svc.ciCdIntegrated && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>CI/CD</span>}
                {svc.inCatalog && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>CATALOG</span>}
                {svc.repoLinked && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>LINKED</span>}
                <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{svc.environments.length} envs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Governance */}
      {activeGovStages.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Governance Architecture</p>
            <EditLink step={4} />
          </div>
          <div className="space-y-2">
            {activeGovStages.map((gs) => {
              const meta = GOVERNANCE_STAGE_META[gs.stage];
              return (
                <div key={gs.stage} className="px-3 py-2 rounded-lg" style={{ background: `${meta.color}06`, border: `1px solid ${meta.color}15` }}>
                  <p className="text-xs font-semibold" style={{ color: meta.color }}>{meta.title}</p>
                  <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{gs.rules.join(" · ")}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backfill */}
      {backfillMethods.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>
              Backfill Strategy{backfill.estimatedExistingApis ? ` (${backfill.estimatedExistingApis})` : ""}
            </p>
            <EditLink step={5} />
          </div>
          <div className="flex flex-wrap gap-2">
            {backfillMethods.map((m) => (
              <span key={m as string} className="px-2.5 py-1 rounded-lg text-[10px] font-medium" style={{ background: `${POSTMAN_ORANGE}10`, border: `1px solid ${POSTMAN_ORANGE}25`, color: POSTMAN_ORANGE }}>
                {m as string}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Catalog Readiness Summary */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
        <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "#22c55e" }}>API Catalog Readiness</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "In Catalog", value: services.filter((s) => s.inCatalog).length, total: services.length },
            { label: "Has Workspace", value: services.filter((s) => s.hasWorkspace).length, total: services.length },
            { label: "Repo Linked", value: services.filter((s) => s.repoLinked).length, total: services.length },
            { label: "Has Spec", value: services.filter((s) => s.hasSpec).length, total: services.length },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-lg font-bold" style={{ color: m.value === m.total ? "#22c55e" : m.value > 0 ? "#eab308" : "#f87171" }}>{m.value}/{m.total}</p>
              <p className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Discovery Notes */}
      {(discovery.painPoints.length > 0 || discovery.provisioningFlow || discovery.pocTarget) && (
        <div className="rounded-xl p-4 mb-4" style={{ background: `${POSTMAN_ORANGE}06`, border: `1px solid ${POSTMAN_ORANGE}15` }}>
          <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: POSTMAN_ORANGE }}>Discovery Insights</p>
          {discovery.painPoints.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>Pain Points</p>
              <div className="flex flex-wrap gap-1.5">
                {discovery.painPoints.map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded text-[9px]" style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.12)" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {discovery.pocTarget && (
            <div className="mt-2">
              <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>POC Target: <strong style={{ color: "var(--foreground)" }}>{discovery.pocTarget}</strong></p>
            </div>
          )}
          {discovery.idealStakeholder && (
            <div className="mt-1">
              <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Ideal Stakeholder: <strong style={{ color: "var(--foreground)" }}>{discovery.idealStakeholder}</strong></p>
            </div>
          )}
        </div>
      )}

      {/* Acceptance Criteria */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "#a78bfa" }}>Acceptance Criteria — Successful API Catalog Delivery</p>
        <div className="space-y-1.5">
          {[
            "Customer's IDP provisions Postman workspace + collections + environments + tests automatically on new service creation",
            "CI/CD pipeline runs Postman smoke + contract tests on every push",
            "API Catalog shows all provisioned services with health metrics",
            "Platform engineering leader can query service health via Agent Mode",
            "Zero hardcoded secrets in Postman collections",
            "Developer can find and consume any internal API in <30 seconds",
            "Build log captures before/after metrics for renewal proof",
          ].map((criteria) => (
            <div key={criteria} className="flex items-start gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
              <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px]" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>✓</div>
              <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{criteria}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CSE Time Investment */}
      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--foreground-dim)" }}>CSE Time Investment — Est. 11-18 hours over 2-4 weeks</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["Discovery call + prep", "2 hrs"],
            ["Architecture annotation + POC build", "4-8 hrs"],
            ["Follow-up call with DevOps", "1 hr"],
            ["Iteration and troubleshooting", "2-4 hrs"],
            ["Enablement session (customer-specific)", "1-2 hrs"],
            ["Value capture and build log", "1 hr"],
          ].map(([activity, effort]) => (
            <div key={activity} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
              <p className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>{activity}</p>
              <p className="text-[10px] font-medium tabular-nums" style={{ color: POSTMAN_ORANGE }}>{effort}</p>
            </div>
          ))}
        </div>
      </div>

      {/* POC Deliverables Preview */}
      <div className="rounded-xl p-4 mb-4" style={{ background: `${POSTMAN_ORANGE}06`, border: `1px solid ${POSTMAN_ORANGE}15` }}>
        <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: POSTMAN_ORANGE }}>POC Deliverables — Tracked on Project Overview</p>
        <div className="space-y-2">
          {[
            { icon: "⚙️", title: "Provisioning Automation", desc: `Working ${ciCd || "CI/CD"} workflow that provisions Postman workspace + collections + environments + tests from a single trigger` },
            { icon: "🧪", title: "CI/CD Test Integration", desc: `Working ${ciCd || "CI/CD"} integration that runs smoke + contract tests on push and reports results` },
            { icon: "🗺️", title: "Annotated Infrastructure Diagram", desc: "Annotated diagram showing full integration (customer can present internally)" },
            { icon: "📦", title: "Functional Postman Workspace", desc: "Workspace with all generated artifacts visible and functional" },
          ].map((d) => (
            <div key={d.title} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
              <span className="text-sm mt-px">{d.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{d.title}</p>
                <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{d.desc}</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: `${POSTMAN_ORANGE}15`, color: POSTMAN_ORANGE }}>+75 XP</span>
            </div>
          ))}
        </div>
      </div>

      <InfoCallout title="What happens on submit">
        <ul className="space-y-1 list-disc list-inside">
          <li>Service template (OpenAPI spec) generated with infrastructure integration, governance architecture, and catalog readiness</li>
          <li>System topology (nodes + edges) created as a CURRENT_TOPOLOGY phase artifact</li>
          <li>Discovery brief created with full infrastructure, services, governance, backfill, and discovery call notes</li>
          <li>Architecture data ingested as evidence — cascade triggered to recompute all downstream phases</li>
          <li>POC deliverables initialized for tracking on the project overview page</li>
        </ul>
      </InfoCallout>
    </>
  );
}
