import { CardSkeleton, TableRowSkeleton } from "@/components/SkeletonLoader";

export default function JiraLoading() {
  return (
    <div className="space-y-6">
      <CardSkeleton />
      <div className="card overflow-hidden">
        <table className="w-full">
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRowSkeleton key={i} cols={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
