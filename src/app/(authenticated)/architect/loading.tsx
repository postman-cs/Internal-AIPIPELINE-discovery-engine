export default function ArchitectLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,108,55,0.15)" }} />
        <div>
          <div className="h-6 w-48 rounded animate-pulse mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="h-3 w-72 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
      </div>
      <div className="rounded-2xl p-8 animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-5 w-40 rounded mb-4" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="space-y-3">
          <div className="h-10 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="h-10 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
          <div className="h-10 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
      </div>
    </div>
  );
}
