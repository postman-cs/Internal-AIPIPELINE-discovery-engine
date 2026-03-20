import { prisma } from "@/lib/prisma";

export default async function AIRoutingPage() {
  const scores = await prisma.modelQualityScore.findMany({
    orderBy: [{ agentType: "asc" }, { sampleCount: "desc" }],
  });

  const grouped = new Map<string, typeof scores>();
  for (const score of scores) {
    if (!grouped.has(score.agentType)) grouped.set(score.agentType, []);
    grouped.get(score.agentType)!.push(score);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          AI Model Routing
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Dynamic quality scoring determines which model handles each agent type. Scores update after every run.
        </p>
      </div>

      {grouped.size === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
            No model quality scores yet. Scores are recorded after each agent run.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([agentType, models]) => (
            <div key={agentType} className="card">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                {agentType}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--surface)" }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Score</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Success Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Avg Latency</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Avg Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Samples</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => {
                      const score =
                        m.successRate * 0.5 +
                        (1 / Math.max(m.avgLatencyMs, 1)) * 0.3 * 1000 +
                        (1 / Math.max(m.avgTokenCost, 0.0001)) * 0.2;
                      const isTopModel = models.indexOf(m) === 0 && m.sampleCount >= 5;

                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: isTopModel ? "rgba(16,185,129,0.03)" : undefined,
                          }}
                        >
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono font-medium" style={{ color: "var(--foreground)" }}>
                              {m.modelId}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                background: score > 0.6 ? "rgba(16,185,129,0.1)" : score > 0.3 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                                color: score > 0.6 ? "#34d399" : score > 0.3 ? "#fbbf24" : "#f87171",
                              }}
                            >
                              {score.toFixed(4)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium"
                              style={{
                                color: m.successRate >= 0.9 ? "#34d399" : m.successRate >= 0.7 ? "#fbbf24" : "#f87171",
                              }}
                            >
                              {(m.successRate * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
                            {m.avgLatencyMs.toFixed(0)}ms
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
                            ${m.avgTokenCost.toFixed(4)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-mono"
                              style={{ color: m.sampleCount >= 5 ? "var(--foreground)" : "var(--foreground-dim)" }}
                            >
                              {m.sampleCount}
                              {m.sampleCount < 5 && (
                                <span className="ml-1 text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                                  (warming up)
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium cursor-default"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                color: "var(--foreground-dim)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {`AI_MODEL_${m.agentType.replace(/[^a-zA-Z0-9]/g, "_")}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
