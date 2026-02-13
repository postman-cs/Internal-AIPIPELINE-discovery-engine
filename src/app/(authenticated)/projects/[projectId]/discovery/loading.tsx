import { Skeleton, StatSkeleton, CardSkeleton } from "@/components/SkeletonLoader";

export default function DiscoveryLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Cascade flow */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Skeleton className="h-3 w-40 mb-3" />
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-7 h-7 rounded-full" />
              {i < 5 && <Skeleton className="w-8 h-px" />}
            </div>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      {/* Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
