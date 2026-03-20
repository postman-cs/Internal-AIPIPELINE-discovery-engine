import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import { getBuildLog } from "@/lib/actions/admin";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BuildLogEditor } from "./BuildLogEditor";
import { BUILD_LOG_TEMPLATE, type BuildLogData } from "@/lib/engagement";
import BuildLogCanvasWrapper from "./BuildLogCanvasWrapper";
import type { SectionStatus, GateStatus } from "./BuildLogCanvas";

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim());
  if (typeof v === "string" && v.trim()) return v.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  return [];
}

function normalizeBuildLog(raw: Record<string, unknown>): BuildLogData {
  const ctx = (raw.context ?? {}) as Record<string, string>;
  const env = (raw.environmentBaseline ?? {}) as Record<string, string>;
  return {
    context: {
      seCse: ctx.seCse || ctx.aeCse || "",
      executiveSponsor: ctx.executiveSponsor || "",
      customerTechnicalLead: ctx.customerTechnicalLead || "",
      pilotTimeline: ctx.pilotTimeline || ctx.sprintDates || "",
    },
    useCase: (raw.useCase as string) || (raw.hypothesis as string) || "",
    useCaseOneSentence: (raw.useCaseOneSentence as string) || "",
    successCriteria: toArray(raw.successCriteria),
    environmentBaseline: {
      scm: env.scm || "",
      ciCd: env.ciCd || "",
      gateway: env.gateway || "",
      cloud: env.cloud || "",
      devPortal: env.devPortal || "",
      secretsManagement: env.secretsManagement || "",
      currentPostmanUsage: env.currentPostmanUsage || "",
      version: env.version || "",
    },
    internalProof: toArray(raw.internalProof),
    whatWeBuilt: toArray(raw.whatWeBuilt),
    valueUnlocked: toArray(raw.valueUnlocked),
    reusablePatterns: toArray(raw.reusablePatterns),
    implementationKit: toArray(raw.implementationKit),
    productGapsRisks: toArray(raw.productGapsRisks),
    caseStudySummary: (raw.caseStudySummary as string) || "",
    nextMotion: (raw.nextMotion as string) || "",
    nextSteps: toArray(raw.nextSteps),
  };
}

async function prepopulateBuildLog(projectId: string, projectOwnerName: string): Promise<{ data: BuildLogData; prepopulated: boolean }> {
  const phases = await prisma.phaseArtifact.findMany({
    where: { projectId, phase: { in: ["DISCOVERY", "CURRENT_TOPOLOGY", "CRAFT_SOLUTION", "TEST_DESIGN", "INFRASTRUCTURE", "DEPLOYMENT_PLAN"] } },
    orderBy: { version: "desc" },
    distinct: ["phase"],
    select: { phase: true, contentJson: true },
  });

  const phaseMap = new Map<string, Record<string, unknown>>();
  for (const p of phases) {
    phaseMap.set(p.phase, (p.contentJson ?? {}) as Record<string, unknown>);
  }

  if (phaseMap.size === 0) return { data: BUILD_LOG_TEMPLATE, prepopulated: false };

  const disc = phaseMap.get("DISCOVERY") ?? {};
  const topo = phaseMap.get("CURRENT_TOPOLOGY") ?? {};
  const craft = phaseMap.get("CRAFT_SOLUTION") ?? {};
  const testDesign = phaseMap.get("TEST_DESIGN") ?? {};
  const infra = phaseMap.get("INFRASTRUCTURE") ?? {};
  const deploy = phaseMap.get("DEPLOYMENT_PLAN") ?? {};

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { serviceTemplateType: true },
  });

  const snap = (disc.companySnapshot ?? {}) as Record<string, unknown>;
  const hyp = (disc.hypothesis ?? {}) as Record<string, unknown>;

  const techLandscape = (disc.technicalFindings ?? []) as Array<Record<string, unknown>>;
  const findSignal = (key: string) => {
    const found = techLandscape.find((t) => typeof t.signal === "string" && t.signal.toLowerCase().includes(key.toLowerCase()));
    return (found?.finding as string) ?? "";
  };

  const collections = ((craft.postmanCollections ?? []) as Array<Record<string, unknown>>).map((c) => c.name as string).filter(Boolean);
  const pipelines = ((craft.ciCdPipelines ?? []) as Array<Record<string, unknown>>).map((p) => `${p.platformLabel}: ${p.filename}`).filter(Boolean);
  const testCases = ((testDesign.testCases ?? []) as Array<Record<string, unknown>>).map((t) => t.title as string || t.name as string).filter(Boolean);

  const iacSnippets = ((infra.iacSnippets ?? []) as Array<Record<string, unknown>>).map((s) => `${s.name}: ${s.language}`).filter(Boolean);

  const pipelinePlatforms = ((craft.ciCdPipelines ?? []) as Array<Record<string, unknown>>)
    .map((p) => (p.platformLabel as string) || "")
    .filter(Boolean);
  const envGates = (deploy.environmentPromotionGates ?? []) as Array<Record<string, unknown>>;
  const envNames = [...new Set(envGates.flatMap((g) => [g.fromEnv as string, g.toEnv as string].filter(Boolean)))];
  const ciCdNotes = ((craft.ciCdNotes ?? []) as string[]).filter((s) => typeof s === "string" && s.trim());
  const deployChangeNotes = ((deploy.changeManagementNotes ?? []) as string[]).filter((s) => typeof s === "string" && s.trim());

  const nodes = (topo.nodes ?? []) as Array<Record<string, unknown>>;
  const cloudNode = nodes.find((n) => ((n.type as string) ?? "").includes("CLOUD") || ((n.name as string) ?? "").toLowerCase().includes("aws") || ((n.name as string) ?? "").toLowerCase().includes("azure"));

  const data: BuildLogData = {
    context: {
      seCse: projectOwnerName,
      executiveSponsor: "",
      customerTechnicalLead: "",
      pilotTimeline: "",
    },
    useCase: (hyp.text as string) ?? (disc.hypothesis as string) ?? "",
    useCaseOneSentence: "",
    successCriteria: testCases.length > 0 ? testCases.slice(0, 5) : BUILD_LOG_TEMPLATE.successCriteria,
    environmentBaseline: {
      scm: findSignal("SCM") || findSignal("GitHub") || findSignal("Git") || "",
      ciCd: findSignal("CI/CD") || findSignal("pipeline") || findSignal("jenkins") || pipelinePlatforms.join(", ") || "",
      gateway: findSignal("gateway") || findSignal("Gateway") || "",
      cloud: (cloudNode?.name as string) ?? findSignal("cloud") ?? findSignal("AWS") ?? "",
      devPortal: findSignal("portal") || findSignal("developer") || "",
      secretsManagement: findSignal("secrets") || findSignal("vault") || "",
      currentPostmanUsage: (snap.postmanUsage as string) ?? "",
      version: project?.serviceTemplateType ?? "",
    },
    internalProof: BUILD_LOG_TEMPLATE.internalProof,
    whatWeBuilt: [
      ...collections.map((c) => `Postman Collection: ${c}`),
      ...pipelines.map((p) => `CI/CD Pipeline: ${p}`),
      ...iacSnippets.map((s) => `IaC: ${s}`),
      ...(envNames.length > 0 ? [`Environment promotion: ${envNames.join(" → ")}`] : []),
    ].slice(0, 10),
    valueUnlocked: BUILD_LOG_TEMPLATE.valueUnlocked,
    reusablePatterns: (() => {
      const computed = [
        ...pipelinePlatforms.map((p) => `CI/CD pipeline config: ${p}`),
        ...collections.map((c) => `Collection template: ${c}`),
        ...iacSnippets.map((s) => `IaC snippet: ${s}`),
      ].slice(0, 8);
      return computed.length > 0 ? computed : BUILD_LOG_TEMPLATE.reusablePatterns;
    })(),
    implementationKit: BUILD_LOG_TEMPLATE.implementationKit,
    productGapsRisks: (() => {
      const computed = [...ciCdNotes, ...deployChangeNotes].slice(0, 6);
      return computed.length > 0 ? computed : BUILD_LOG_TEMPLATE.productGapsRisks;
    })(),
    caseStudySummary: "",
    nextMotion: "",
    nextSteps: BUILD_LOG_TEMPLATE.nextSteps,
  };

  return { data, prepopulated: true };
}

export default async function BuildLogPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [artifact, gateArtifacts] = await Promise.all([
    getBuildLog(projectId),
    prisma.phaseArtifact.findMany({
      where: { projectId },
      select: { phase: true, status: true, version: true },
      distinct: ["phase"],
      orderBy: { version: "desc" },
    }),
  ]);

  const existing = artifact
    ? normalizeBuildLog(artifact.contentJson as Record<string, unknown>)
    : null;

  const previousArtifact = artifact && artifact.version > 1
    ? await prisma.phaseArtifact.findFirst({
        where: { projectId, phase: "BUILD_LOG", version: { lt: artifact.version } },
        orderBy: { version: "desc" },
      })
    : null;
  const previousData = previousArtifact
    ? normalizeBuildLog(previousArtifact.contentJson as Record<string, unknown>)
    : null;

  let initial: BuildLogData;
  let prepopulated = false;
  if (existing) {
    initial = existing;
  } else {
    const ownerName = project.owner?.name ?? project.owner?.email ?? "";
    const result = await prepopulateBuildLog(projectId, ownerName);
    initial = result.data;
    prepopulated = result.prepopulated;
  }

  const cascadePhases = ["DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN", "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN"];
  const deliveryGates = [
    {
      label: "Service template uploaded",
      passed: !!project.serviceTemplateContent,
      href: `/projects/${projectId}/discovery`,
    },
    {
      label: "Discovery complete",
      passed: gateArtifacts.some((a) => a.phase === "DISCOVERY" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS")),
      href: `/projects/${projectId}/discovery`,
    },
    {
      label: "Cascade complete (9 phases)",
      passed: cascadePhases.every((p) =>
        gateArtifacts.some((a) => a.phase === p && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS"))
      ),
      href: `/projects/${projectId}/updates`,
    },
    {
      label: "Repo initialized",
      passed: !!project.gitRepoName,
      href: `/projects/${projectId}/repo`,
    },
    {
      label: "Artifacts pushed to repo",
      passed: !!project.lastRepoPushAt,
      href: `/projects/${projectId}/repo`,
    },
    {
      label: "Build log saved",
      passed: !!artifact && artifact.version >= 1,
      href: null,
    },
  ];

  const gatesPassed = deliveryGates.filter((g) => g.passed).length;
  const allGatesPassed = gatesPassed === deliveryGates.length;

  const sectionMeta: Array<{ key: string; label: string; shortLabel: string; color: string; test: (d: BuildLogData) => boolean }> = [
    { key: "context", label: "Context", shortLabel: "CTX", color: "#3b82f6", test: (d) => !!(d.context.seCse && d.context.customerTechnicalLead && d.context.pilotTimeline) },
    { key: "useCase", label: "Use Case", shortLabel: "USE", color: "#8b5cf6", test: (d) => !!(d.useCase.trim() && d.useCaseOneSentence.trim()) },
    { key: "successCriteria", label: "Success Criteria", shortLabel: "SUC", color: "#22c55e", test: (d) => d.successCriteria.length > 0 },
    { key: "environmentBaseline", label: "Environment Baseline", shortLabel: "ENV", color: "#f59e0b", test: (d) => Object.values(d.environmentBaseline).filter((v) => typeof v === "string" && v.trim()).length >= 3 },
    { key: "internalProof", label: "Internal Proof", shortLabel: "PRF", color: "#a855f7", test: (d) => d.internalProof.length > 0 },
    { key: "whatWeBuilt", label: "What We Built", shortLabel: "BLT", color: "#06b6d4", test: (d) => d.whatWeBuilt.length > 0 },
    { key: "valueUnlocked", label: "Value Unlocked", shortLabel: "VAL", color: "#10b981", test: (d) => d.valueUnlocked.length > 0 },
    { key: "reusablePatterns", label: "Reusable Patterns", shortLabel: "PAT", color: "#a855f7", test: (d) => d.reusablePatterns.length > 0 },
    { key: "implementationKit", label: "Implementation Kit", shortLabel: "KIT", color: "#14b8a6", test: (d) => d.implementationKit.length > 0 },
    { key: "productGapsRisks", label: "Product Gaps / Risks", shortLabel: "GAP", color: "#ef4444", test: (d) => d.productGapsRisks.length > 0 },
    { key: "caseStudySummary", label: "Case Study Summary", shortLabel: "CSE", color: "#c9a227", test: (d) => !!d.caseStudySummary.trim() },
    { key: "nextMotion", label: "Next Motion", shortLabel: "NXT", color: "#6366f1", test: (d) => !!d.nextMotion.trim() },
    { key: "nextSteps", label: "Next Steps", shortLabel: "STP", color: "#06d6d6", test: (d) => d.nextSteps.length > 0 },
  ];

  const canvasSections: SectionStatus[] = sectionMeta.map((s) => ({
    key: s.key,
    label: s.label,
    shortLabel: s.shortLabel,
    color: s.color,
    complete: s.test(initial),
  }));

  const canvasGates: GateStatus[] = deliveryGates.map((g) => ({ label: g.label, passed: g.passed }));
  const completedSectionCount = canvasSections.filter((s) => s.complete).length;
  const canvasProgressPct = Math.round((completedSectionCount / canvasSections.length) * 100);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
      {/* Holographic Mission Debrief */}
      <div className="mb-8">
        <BuildLogCanvasWrapper
          sections={canvasSections}
          gates={canvasGates}
          progressPct={canvasProgressPct}
          allGatesPassed={allGatesPassed}
          projectName={project.name}
        />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,214,214,0.15))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--foreground)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              Build Log
            </h1>
            <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              Use case activation documentation for {project.name}
            </p>
          </div>
          {artifact && (
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full ml-auto"
              style={{
                background: "rgba(16,185,129,0.08)",
                color: "#34d399",
                border: "1px solid rgba(16,185,129,0.15)",
              }}
            >
              v{artifact.version} · Saved {artifact.lastComputedAt?.toLocaleDateString() ?? ""}
            </span>
          )}
        </div>
      </div>

      {/* Delivery Gate Checklist */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: "var(--surface)",
          border: `1px solid ${allGatesPassed ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Delivery Gates
          </h3>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: allGatesPassed ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
              color: allGatesPassed ? "#34d399" : "var(--foreground-dim)",
              border: `1px solid ${allGatesPassed ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
            }}
          >
            {gatesPassed}/{deliveryGates.length} passed
          </span>
        </div>
        <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.round((gatesPassed / deliveryGates.length) * 100)}%`,
              background: allGatesPassed ? "linear-gradient(to right, #10b981, #34d399)" : "linear-gradient(to right, #06b6d4, #22c55e)",
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {deliveryGates.map((gate) => (
            <div key={gate.label} className="flex items-center gap-2.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: gate.passed ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${gate.passed ? "#34d399" : "var(--border)"}`,
                }}
              >
                {gate.passed ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border-bright)" }} />
                )}
              </div>
              {gate.href ? (
                <Link
                  href={gate.href}
                  className="text-xs hover:underline"
                  style={{ color: gate.passed ? "#34d399" : "var(--foreground-muted)" }}
                >
                  {gate.label}
                </Link>
              ) : (
                <span className="text-xs" style={{ color: gate.passed ? "#34d399" : "var(--foreground-muted)" }}>
                  {gate.label}
                </span>
              )}
            </div>
          ))}
        </div>
        {allGatesPassed && (
          <div className="mt-3 pt-3 text-center" style={{ borderTop: "1px solid rgba(16,185,129,0.15)" }}>
            <p className="text-xs font-semibold" style={{ color: "#34d399" }}>
              All delivery gates passed — ready for handoff
            </p>
          </div>
        )}
      </div>

      {prepopulated && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", color: "#a78bfa" }}>
          Pre-filled from cascade data — review and edit before saving.
        </div>
      )}

      <BuildLogEditor
        projectId={projectId}
        initial={initial}
        previousVersion={previousData}
        deliveryGates={deliveryGates}
      />
    </div>
  );
}
