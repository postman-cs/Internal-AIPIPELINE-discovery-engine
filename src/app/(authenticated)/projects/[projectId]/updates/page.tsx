import Link from "next/link";
import { getCascadeState } from "@/lib/actions/cascade";
import { getProject } from "@/lib/actions/projects";
import { getAssumptionHealthCheck } from "@/lib/actions/assumptions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CascadeUpdatesPanel } from "./CascadeUpdatesPanel";

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [cascadeState, healthCheck, activeBlockers] = await Promise.all([
    getCascadeState(projectId),
    getAssumptionHealthCheck(projectId),
    prisma.blocker.count({
      where: { projectId, status: { notIn: ["NEUTRALIZED", "ACCEPTED", "DORMANT"] } },
    }),
  ]);

  const assumptionHealthy = healthCheck && !healthCheck.error && healthCheck.healthy;
  const pendingAssumptions = healthCheck?.summary?.criticalPending?.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Cascade Updates
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Evidence-driven update proposals. New evidence triggers impact analysis and proposals for your review.
        </p>
      </div>

      {/* Assumption Gate + Blocker Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link
          href={`/projects/${projectId}/assumptions`}
          className="rounded-xl p-4 flex items-center gap-3 transition-all duration-200 group"
          style={{
            background: assumptionHealthy ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
            border: `1px solid ${assumptionHealthy ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.25)"}`,
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: assumptionHealthy ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
              color: assumptionHealthy ? "#34d399" : "#fbbf24",
            }}
          >
            {assumptionHealthy ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: assumptionHealthy ? "#34d399" : "#fbbf24" }}>
              {assumptionHealthy ? "Assumption Gate Clear" : `${pendingAssumptions} Critical Assumption${pendingAssumptions !== 1 ? "s" : ""} Pending`}
            </p>
            <p className="text-[11px]" style={{ color: "var(--foreground-dim)" }}>
              {assumptionHealthy ? "All verified. Cascade can proceed freely." : "Verify before cascade can resume."}
            </p>
          </div>
          <span className="text-xs group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--foreground-dim)" }}>&rarr;</span>
        </Link>

        <Link
          href={`/projects/${projectId}/blockers`}
          className="rounded-xl p-4 flex items-center gap-3 transition-all duration-200 group"
          style={{
            background: activeBlockers === 0 ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${activeBlockers === 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.25)"}`,
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: activeBlockers === 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
              color: activeBlockers === 0 ? "#34d399" : "#f87171",
            }}
          >
            {activeBlockers === 0 ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: activeBlockers === 0 ? "#34d399" : "#f87171" }}>
              {activeBlockers === 0 ? "No Active Blockers" : `${activeBlockers} Active Blocker${activeBlockers !== 1 ? "s" : ""}`}
            </p>
            <p className="text-[11px]" style={{ color: "var(--foreground-dim)" }}>
              {activeBlockers === 0 ? "Pipeline is clear." : "Active blockers may impact cascade output."}
            </p>
          </div>
          <span className="text-xs group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--foreground-dim)" }}>&rarr;</span>
        </Link>
      </div>

      <CascadeUpdatesPanel projectId={projectId} cascadeState={cascadeState} />
    </div>
  );
}
