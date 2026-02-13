"use client";

import { deleteAssumption } from "@/lib/actions/admin";
import { AdminTable, StatusBadge } from "../AdminTable";

type AssumptionRow = {
  id: string; category: string; claim: string; confidence: string;
  status: string; phase: string; impact: string | null;
  project: { name: string };
};

export function AssumptionsClient({ assumptions }: { assumptions: AssumptionRow[] }) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Assumptions</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{assumptions.length} assumptions surfaced</p>
        </div>
      </div>

      <AdminTable
        columns={[
          { key: "claim", label: "Claim", render: (r) => (
            <div>
              <p className="font-medium text-sm max-w-md truncate">{r.claim}</p>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.project.name} | {r.phase}</p>
            </div>
          )},
          { key: "category", label: "Category", render: (r) => <span className="text-xs capitalize">{r.category.replace(/_/g, " ")}</span> },
          { key: "confidence", label: "Confidence", render: (r) => (
            <span className="text-xs font-medium" style={{ color: r.confidence === "High" ? "var(--accent-green)" : r.confidence === "Medium" ? "var(--accent-yellow)" : "var(--foreground-dim)" }}>
              {r.confidence}
            </span>
          )},
          { key: "impact", label: "Impact", render: (r) => <span className="text-xs capitalize">{r.impact?.replace(/_/g, " ") ?? "—"}</span> },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
        rows={assumptions}
        getRowId={(r) => r.id}
        onDelete={deleteAssumption}
        emptyMessage="No assumptions surfaced yet"
      />
    </>
  );
}
