"use client";

import { deleteBlocker } from "@/lib/actions/admin";
import { AdminTable, StatusBadge } from "../AdminTable";

type BlockerRow = {
  id: string; title: string; domain: string; severity: string; status: string;
  description: string | null; surfacedByPhase: string | null;
  project: { name: string };
  _count: { missiles: number; nukes: number };
};

export function BlockersClient({ blockers }: { blockers: BlockerRow[] }) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Blockers</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{blockers.length} blockers tracked</p>
        </div>
      </div>

      <AdminTable
        columns={[
          { key: "title", label: "Blocker", render: (r) => (
            <div>
              <p className="font-medium">{r.title}</p>
              <p className="text-xs truncate max-w-xs" style={{ color: "var(--foreground-dim)" }}>{r.description ?? "—"}</p>
            </div>
          )},
          { key: "project", label: "Project", render: (r) => <span className="text-xs">{r.project.name}</span> },
          { key: "domain", label: "Domain", render: (r) => <StatusBadge status={r.domain} /> },
          { key: "severity", label: "Severity", render: (r) => <StatusBadge status={r.severity} /> },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "missiles", label: "Missiles", render: (r) => r._count.missiles },
          { key: "nukes", label: "Nukes", render: (r) => r._count.nukes },
          { key: "phase", label: "Phase", render: (r) => <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.surfacedByPhase ?? "—"}</span> },
        ]}
        rows={blockers}
        getRowId={(r) => r.id}
        onDelete={deleteBlocker}
        emptyMessage="No blockers identified yet"
      />
    </>
  );
}
