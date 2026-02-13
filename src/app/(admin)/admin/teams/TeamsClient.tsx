"use client";

import { useActionState } from "react";
import { createTeam, deleteTeam } from "@/lib/actions/admin";
import { AdminTable, AdminFormWrapper, FormField, StatusBadge } from "../AdminTable";

type TeamRow = {
  id: string; name: string; department: string | null; teamSize: number;
  adoptionStage: string; adoptionScore: number; resistanceLevel: string;
  championActive: boolean; ciPlatform: string | null;
  project: { name: string }; wave: { name: string; waveNumber: number } | null;
};

export function TeamsClient({ teams, projects, waves }: {
  teams: TeamRow[];
  projects: Array<{ id: string; name: string }>;
  waves: Array<{ id: string; name: string; project: { name: string } }>;
}) {
  const [state, action, pending] = useActionState(createTeam, null);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Adoption Teams</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{teams.length} teams tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminTable
            columns={[
              { key: "name", label: "Team", render: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.department ?? "—"} | {r.project.name}</p>
                </div>
              )},
              { key: "stage", label: "Stage", render: (r) => <StatusBadge status={r.adoptionStage} /> },
              { key: "score", label: "Score", render: (r) => (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--background)" }}>
                    <div className="h-full rounded-full" style={{ width: `${r.adoptionScore}%`, background: r.adoptionScore >= 70 ? "var(--accent-green)" : r.adoptionScore >= 40 ? "var(--accent-yellow)" : "var(--accent-red)" }} />
                  </div>
                  <span className="text-xs tabular-nums">{r.adoptionScore}</span>
                </div>
              )},
              { key: "size", label: "Size", render: (r) => r.teamSize },
              { key: "resistance", label: "Resistance", render: (r) => <StatusBadge status={r.resistanceLevel} /> },
              { key: "wave", label: "Wave", render: (r) => r.wave ? `Wave ${r.wave.waveNumber}` : <span style={{ color: "var(--foreground-dim)" }}>—</span> },
              { key: "champion", label: "Champion", render: (r) => r.championActive ? <span style={{ color: "var(--accent-green)" }}>Yes</span> : <span style={{ color: "var(--foreground-dim)" }}>No</span> },
            ]}
            rows={teams}
            getRowId={(r) => r.id}
            onDelete={deleteTeam}
            emptyMessage="No teams tracked yet"
          />
        </div>

        <div>
          <AdminFormWrapper title="Add Team" action={action} state={state} pending={pending}>
            <FormField label="Project" name="projectId" type="select" required options={projects.map((p) => ({ value: p.id, label: p.name }))} />
            <FormField label="Team Name" name="name" required placeholder="Payments API Team" />
            <FormField label="Department" name="department" placeholder="Engineering" />
            <FormField label="Team Size" name="teamSize" type="number" placeholder="10" />
            <FormField label="Team Lead" name="teamLead" placeholder="Jane Doe" />
            <FormField label="CI Platform" name="ciPlatform" type="select" options={[
              { value: "github_actions", label: "GitHub Actions" },
              { value: "jenkins", label: "Jenkins" },
              { value: "gitlab_ci", label: "GitLab CI" },
              { value: "azure_devops", label: "Azure DevOps" },
              { value: "circleci", label: "CircleCI" },
              { value: "bitbucket", label: "Bitbucket Pipelines" },
            ]} />
            <FormField label="Wave" name="waveId" type="select" options={waves.map((w) => ({ value: w.id, label: `${w.name} (${w.project.name})` }))} />
          </AdminFormWrapper>
        </div>
      </div>
    </>
  );
}
