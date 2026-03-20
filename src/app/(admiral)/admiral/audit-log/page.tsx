import { prisma } from "@/lib/prisma";

export default async function AuditLogPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const userIds = [...new Set(logs.map((l) => l.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>
        Audit Log
      </h1>

      <div
        className="overflow-x-auto rounded-xl"
        style={{
          border: "1px solid var(--border)",
          background: "rgba(17, 21, 36, 0.6)",
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Time</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>User</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Action</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Target</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  No audit log entries yet.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr
                key={log.id}
                className="transition-colors duration-100"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: "var(--foreground-dim)" }}>
                  {log.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground)" }}>
                  {userMap.get(log.userId)?.name ?? log.userId}
                </td>
                <td className="px-4 py-3 text-sm">
                  <ActionBadge action={log.action} />
                </td>
                <td className="px-4 py-3 text-sm font-mono" style={{ color: "var(--foreground-dim)" }}>
                  {log.targetType ? `${log.targetType}:` : ""}
                  {log.targetId ? log.targetId.slice(0, 12) : "—"}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground-dim)" }}>
                  {log.metadataJson ? (
                    <span className="font-mono text-xs">
                      {JSON.stringify(log.metadataJson).slice(0, 80)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    LOGIN: "rgba(59, 130, 246, 0.15)",
    LOGOUT: "rgba(107, 114, 128, 0.15)",
    PROJECT_CREATE: "rgba(16, 185, 129, 0.15)",
    PROJECT_DELETE: "rgba(239, 68, 68, 0.15)",
    PROPOSAL_ACCEPT: "rgba(16, 185, 129, 0.15)",
    PROPOSAL_REJECT: "rgba(239, 68, 68, 0.15)",
    CASCADE_TRIGGER: "rgba(139, 92, 246, 0.15)",
    SECRET_ACCESS: "rgba(245, 158, 11, 0.15)",
    ROLE_CHANGE: "rgba(245, 158, 11, 0.15)",
    EXPORT: "rgba(59, 130, 246, 0.15)",
  };

  const textColorMap: Record<string, string> = {
    LOGIN: "#60a5fa",
    LOGOUT: "#9ca3af",
    PROJECT_CREATE: "#34d399",
    PROJECT_DELETE: "#f87171",
    PROPOSAL_ACCEPT: "#34d399",
    PROPOSAL_REJECT: "#f87171",
    CASCADE_TRIGGER: "#a78bfa",
    SECRET_ACCESS: "#fbbf24",
    ROLE_CHANGE: "#fbbf24",
    EXPORT: "#60a5fa",
  };

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: colorMap[action] ?? "rgba(107, 114, 128, 0.15)",
        color: textColorMap[action] ?? "#9ca3af",
      }}
    >
      {action}
    </span>
  );
}
