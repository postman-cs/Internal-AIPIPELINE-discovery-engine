import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function EvalsPage() {
  const results = await prisma.agentEvalResult.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const grouped = new Map<
    string,
    { total: number; passed: number; failed: number; avgDuration: number }
  >();
  for (const r of results) {
    if (!grouped.has(r.agentType)) {
      grouped.set(r.agentType, { total: 0, passed: 0, failed: 0, avgDuration: 0 });
    }
    const g = grouped.get(r.agentType)!;
    g.total++;
    if (r.passed) g.passed++;
    else g.failed++;
    g.avgDuration = (g.avgDuration * (g.total - 1) + (r.durationMs ?? 0)) / g.total;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm mb-2" style={{ color: "var(--foreground-dim)" }}>
          <Link href="/dashboard" className="transition-colors hover-link">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/ai-runs" className="transition-colors hover-link">AI Runs</Link>
          <span>/</span>
          <span style={{ color: "var(--foreground)" }}>Evaluations</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Agent Evaluation Results
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Pass/fail rates and assertion outcomes across all agent evaluation suites.
        </p>
      </div>

      {grouped.size === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            No evaluation results yet. Run an eval suite to see results here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from(grouped.entries()).map(([agentType, stats]) => {
              const passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
              return (
                <div key={agentType} className="card" style={{ padding: "1rem" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>
                    {agentType}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: passRate >= 80 ? "#34d399" : passRate >= 50 ? "#fbbf24" : "#f87171" }}
                    >
                      {passRate.toFixed(0)}%
                    </span>
                    <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                      {stats.passed}/{stats.total} passed
                    </span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--foreground-dim)" }}>
                    Avg {(stats.avgDuration / 1000).toFixed(1)}s
                  </p>
                </div>
              );
            })}
          </div>

          {/* Results Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Test Case</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Model</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Result</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 100).map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--foreground)" }}>{r.agentType}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-dim)" }}>{r.testCaseId}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-dim)" }}>{r.modelId}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: r.passed ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                            color: r.passed ? "#34d399" : "#f87171",
                          }}
                        >
                          {r.passed ? "PASS" : "FAIL"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
                        {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--foreground-dim)" }}>
                        {r.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
