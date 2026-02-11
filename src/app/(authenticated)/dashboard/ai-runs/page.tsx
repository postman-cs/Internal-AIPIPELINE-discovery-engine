import Link from "next/link";
import { getAllAIRuns, getAIRunStats } from "@/lib/actions/discovery";
import { AIRunsTable } from "./AIRunsTable";

export default async function AIRunsPage() {
  const [runs, stats] = await Promise.all([
    getAllAIRuns(100),
    getAIRunStats(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm mb-2" style={{ color: "var(--foreground-dim)" }}>
          <Link
            href="/dashboard"
            className="transition-colors hover-link"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: "var(--foreground)" }}>AI Runs</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          AI Pipeline Observability
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Every LLM call is logged with prompt hash, token usage, duration, and
          status.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <StatCard label="Total Runs" value={stats.total} />
        <StatCard label="Success" value={stats.success} color="var(--accent-green)" />
        <StatCard label="Failed" value={stats.failed} color="var(--accent-red)" />
        <StatCard label="Running" value={stats.running} color="var(--accent-yellow)" />
        <StatCard label="Prompt Tokens" value={formatNumber(stats.tokens.prompt)} sub />
        <StatCard label="Completion Tokens" value={formatNumber(stats.tokens.completion)} sub />
        <StatCard label="Total Tokens" value={formatNumber(stats.tokens.total)} color="var(--accent-orange)" sub />
      </div>

      {/* Runs Table */}
      {runs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            No AI runs yet. Ingest evidence and run the Discovery Pipeline on a
            project to see logs here.
          </p>
          <Link
            href="/projects"
            className="text-sm mt-2 inline-block"
            style={{ color: "var(--accent-cyan)" }}
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <AIRunsTable runs={runs} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  color?: string;
  sub?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "0.75rem 1rem" }}>
      <p
        className="text-[11px] uppercase tracking-wider mb-1"
        style={{ color: "var(--foreground-dim)" }}
      >
        {label}
      </p>
      <p
        className={`${sub ? "text-lg" : "text-2xl"} font-bold`}
        style={{ color: color || "var(--foreground)" }}
      >
        {value}
      </p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
