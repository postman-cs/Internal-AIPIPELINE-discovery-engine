import { Skeleton, CardSkeleton } from "@/components/SkeletonLoader";

export default function UpdatesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Skeleton className="h-7 w-44 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* Gate indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 mb-1" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-36 mb-1" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        </div>
      </div>
      <Skeleton className="h-10 w-48 rounded-lg mb-6" />
      <CardSkeleton />
      <div className="mt-4">
        <CardSkeleton />
      </div>
    </div>
  );
}
