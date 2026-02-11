import Link from "next/link";
import { getAllAIRuns, getAIRunStats } from "@/lib/actions/discovery";
import { AIRunsTable } from "./AIRunsTable";

export default async function AIRunsPage() {
  const [runs, stats] = await Promise.all([
    getAllAIRuns(100),
    getAIRunStats(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link
            href="/dashboard"
            className="hover:text-[#ff6c37] transition-colors"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">AI Runs</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          AI Pipeline Observability
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Every LLM call is logged with prompt hash, token usage, duration, and
          status. No black-box hallucination risk.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <StatCard label="Total Runs" value={stats.total} />
        <StatCard
          label="Success"
          value={stats.success}
          color="text-green-600"
        />
        <StatCard label="Failed" value={stats.failed} color="text-red-600" />
        <StatCard
          label="Running"
          value={stats.running}
          color="text-yellow-600"
        />
        <StatCard
          label="Prompt Tokens"
          value={formatNumber(stats.tokens.prompt)}
          sub
        />
        <StatCard
          label="Completion Tokens"
          value={formatNumber(stats.tokens.completion)}
          sub
        />
        <StatCard
          label="Total Tokens"
          value={formatNumber(stats.tokens.total)}
          color="text-[#ff6c37]"
          sub
        />
      </div>

      {/* Runs Table */}
      {runs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-sm">
            No AI runs yet. Ingest evidence and run the Discovery Pipeline on a
            project to see logs here.
          </p>
          <Link
            href="/projects"
            className="text-sm text-[#ff6c37] hover:underline mt-2 inline-block"
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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </p>
      <p
        className={`${sub ? "text-lg" : "text-2xl"} font-bold ${
          color || "text-gray-900 dark:text-gray-100"
        }`}
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
