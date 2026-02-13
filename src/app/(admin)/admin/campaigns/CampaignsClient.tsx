"use client";

import { deleteCampaign } from "@/lib/actions/admin";
import { AdminTable, StatusBadge } from "../AdminTable";

type CampaignRow = {
  id: string; name: string; status: string; cadence: string;
  totalSteps: number; currentStep: number; targetAudience: string | null;
  aiGenerated: boolean; recipientCount: number;
  project: { name: string };
  wave: { name: string; waveNumber: number } | null;
};

export function CampaignsClient({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Drip Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{campaigns.length} campaigns</p>
        </div>
      </div>

      <AdminTable
        columns={[
          { key: "name", label: "Campaign", render: (r) => (
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.project.name}{r.wave ? ` | Wave ${r.wave.waveNumber}` : ""}</p>
            </div>
          )},
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "progress", label: "Progress", render: (r) => (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--background)" }}>
                <div className="h-full rounded-full" style={{ width: `${r.totalSteps > 0 ? (r.currentStep / r.totalSteps) * 100 : 0}%`, background: "var(--accent-cyan)" }} />
              </div>
              <span className="text-xs tabular-nums">{r.currentStep}/{r.totalSteps}</span>
            </div>
          )},
          { key: "cadence", label: "Cadence", render: (r) => <span className="text-xs capitalize">{r.cadence.replace("_", " ")}</span> },
          { key: "audience", label: "Audience", render: (r) => <span className="text-xs">{r.targetAudience ?? "—"}</span> },
          { key: "ai", label: "AI", render: (r) => r.aiGenerated ? <span style={{ color: "var(--accent-purple)" }}>AI</span> : <span style={{ color: "var(--foreground-dim)" }}>Manual</span> },
        ]}
        rows={campaigns}
        getRowId={(r) => r.id}
        onDelete={deleteCampaign}
        emptyMessage="No drip campaigns yet"
      />
    </>
  );
}
