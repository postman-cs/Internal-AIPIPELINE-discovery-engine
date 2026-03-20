export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-48 rounded bg-[var(--surface)] mb-2" />
      <div className="h-4 w-96 rounded bg-[var(--surface)] mb-8" />
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="h-5 w-32 rounded bg-[rgba(255,255,255,0.06)] mb-4" />
            <div className="space-y-3">
              <div className="h-10 rounded bg-[rgba(255,255,255,0.04)]" />
              <div className="h-10 rounded bg-[rgba(255,255,255,0.04)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
