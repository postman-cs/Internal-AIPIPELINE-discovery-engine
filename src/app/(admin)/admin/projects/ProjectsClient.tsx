"use client";

import { useActionState } from "react";
import { createProject, deleteProject } from "@/lib/actions/admin";
import { AdminTable, AdminFormWrapper, FormField } from "../AdminTable";

type ProjectRow = {
  id: string; name: string; primaryDomain: string | null; updatedAt: Date;
  owner: { name: string; email: string };
  _count: { sourceDocuments: number; phaseArtifacts: number; discoveryArtifacts: number; assumptions: number; blockers: number; adoptionTeams: number; adoptionWaves: number; dripCampaigns: number };
};
type UserOption = { id: string; name: string; email: string };

export function ProjectsClient({ projects, users }: { projects: ProjectRow[]; users: UserOption[] }) {
  const [state, action, pending] = useActionState(createProject, null);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Projects</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{projects.length} total projects</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminTable
            columns={[
              { key: "name", label: "Name", render: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.primaryDomain ?? "—"}</p>
                </div>
              )},
              { key: "owner", label: "Owner", render: (r) => (
                <span className="text-xs">{r.owner.name}</span>
              )},
              { key: "docs", label: "Docs", render: (r) => r._count.sourceDocuments },
              { key: "phases", label: "Phases", render: (r) => r._count.phaseArtifacts },
              { key: "teams", label: "Teams", render: (r) => r._count.adoptionTeams },
              { key: "blockers", label: "Blockers", render: (r) => r._count.blockers },
              { key: "updated", label: "Updated", render: (r) => (
                <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.updatedAt.toLocaleDateString()}</span>
              )},
            ]}
            rows={projects}
            getRowId={(r) => r.id}
            onDelete={deleteProject}
            emptyMessage="No projects yet"
          />
        </div>

        <div>
          <AdminFormWrapper title="Create Project" action={action} state={state} pending={pending}>
            <FormField label="Name" name="name" required placeholder="Acme Corp" />
            <FormField label="Primary Domain" name="primaryDomain" placeholder="acme.com" />
            <FormField
              label="Owner" name="ownerUserId" type="select" required
              options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
            />
          </AdminFormWrapper>
        </div>
      </div>
    </>
  );
}
