"use client";

import { useActionState } from "react";
import { createWave, deleteWave } from "@/lib/actions/admin";
import { AdminTable, AdminFormWrapper, FormField, StatusBadge } from "../AdminTable";

type WaveRow = {
  id: string; waveNumber: number; name: string; status: string;
  targetTeamCount: number; actualTeamCount: number; gateCleared: boolean;
  project: { name: string };
  _count: { teams: number; dripCampaigns: number };
};

export function WavesClient({ waves, projects }: {
  waves: WaveRow[];
  projects: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createWave, null);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Adoption Waves</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{waves.length} waves configured</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminTable
            columns={[
              { key: "wave", label: "Wave", render: (r) => (
                <div>
                  <p className="font-medium">Wave {r.waveNumber}: {r.name}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.project.name}</p>
                </div>
              )},
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
              { key: "gate", label: "Gate", render: (r) => r.gateCleared ? <span style={{ color: "var(--accent-green)" }}>Cleared</span> : <span style={{ color: "var(--foreground-dim)" }}>Pending</span> },
              { key: "teams", label: "Teams", render: (r) => `${r._count.teams} / ${r.targetTeamCount || "—"}` },
              { key: "campaigns", label: "Campaigns", render: (r) => r._count.dripCampaigns },
            ]}
            rows={waves}
            getRowId={(r) => r.id}
            onDelete={deleteWave}
            emptyMessage="No waves planned yet"
          />
        </div>

        <div>
          <AdminFormWrapper title="Create Wave" action={action} state={state} pending={pending}>
            <FormField label="Project" name="projectId" type="select" required options={projects.map((p) => ({ value: p.id, label: p.name }))} />
            <FormField label="Wave Name" name="name" required placeholder="Pilot Wave" />
            <FormField label="Description" name="description" placeholder="First wave of early adopters" />
          </AdminFormWrapper>
        </div>
      </div>
    </>
  );
}
