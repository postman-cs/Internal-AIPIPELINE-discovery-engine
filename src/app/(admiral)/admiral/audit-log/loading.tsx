export default function AuditLogLoading() {
  return (
    <div>
      <div className="h-8 w-40 rounded mb-6" style={{ background: "var(--surface-hover)" }} />
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          background: "rgba(17, 21, 36, 0.6)",
        }}
      >
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex gap-8">
            {[80, 100, 60, 120, 160].map((w, i) => (
              <div
                key={i}
                className="h-4 rounded animate-pulse"
                style={{ width: w, background: "var(--surface-hover)" }}
              />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 flex gap-8"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {[80, 100, 60, 120, 160].map((w, j) => (
              <div
                key={j}
                className="h-4 rounded animate-pulse"
                style={{ width: w, background: "var(--surface-hover)", opacity: 0.5 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
