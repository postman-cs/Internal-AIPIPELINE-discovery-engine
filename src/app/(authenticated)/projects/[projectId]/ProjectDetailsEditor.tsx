"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProject } from "@/lib/actions/projects";

interface ProjectData {
  id: string;
  name: string;
  primaryDomain: string | null;
  apiDomain: string | null;
  publicWorkspaceUrl: string | null;
  customerContactName: string | null;
  customerContactEmail: string | null;
  jiraProjectKey: string | null;
  postmanWorkspaceId: string | null;
  postmanApiKey: string | null;
  gitProvider: string | null;
  gitRepoOwner: string | null;
  gitRepoName: string | null;
  gitToken: string | null;
  gitBaseBranch: string | null;
  createdAt: Date;
}

interface Props {
  project: ProjectData;
  evidenceSummary: string;
}

const FIELDS: { key: keyof ProjectData; label: string; placeholder: string; section: string; type?: string }[] = [
  { key: "name", label: "Project Name", placeholder: "e.g. GoodLeap", section: "core" },
  { key: "primaryDomain", label: "Primary Domain", placeholder: "e.g. goodleap.com", section: "core" },
  { key: "apiDomain", label: "API Domain", placeholder: "e.g. api.goodleap.com", section: "core" },
  { key: "publicWorkspaceUrl", label: "Public Workspace URL", placeholder: "https://www.postman.com/...", section: "core", type: "url" },
  { key: "customerContactName", label: "Customer Contact", placeholder: "e.g. Tom Testo (Quality & Ops)", section: "contact" },
  { key: "customerContactEmail", label: "Contact Email", placeholder: "e.g. tom@goodleap.com", section: "contact", type: "email" },
  { key: "jiraProjectKey", label: "Jira Project Key", placeholder: "e.g. CSEBOOT", section: "integrations" },
  { key: "postmanWorkspaceId", label: "Postman Workspace ID", placeholder: "Workspace ID for syncing", section: "integrations" },
  { key: "postmanApiKey", label: "Postman API Key", placeholder: "PMAK-...", section: "integrations", type: "password" },
  { key: "gitProvider", label: "Git Provider", placeholder: "github / gitlab / bitbucket", section: "integrations" },
  { key: "gitRepoOwner", label: "Git Repo Owner", placeholder: "e.g. postman-cs", section: "integrations" },
  { key: "gitRepoName", label: "Git Repo Name", placeholder: "e.g. goodleap-onboarding", section: "integrations" },
  { key: "gitToken", label: "Git Token (PAT)", placeholder: "ghp_...", section: "integrations", type: "password" },
  { key: "gitBaseBranch", label: "Git Base Branch", placeholder: "e.g. main", section: "integrations" },
];

export function ProjectDetailsEditor({ project, evidenceSummary }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) init[f.key] = (project[f.key] as string) ?? "";
    return init;
  });
  const [saving, startSave] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleSave() {
    setError("");
    startSave(async () => {
      const data: Record<string, string | null> = {};
      for (const f of FIELDS) {
        const val = form[f.key]?.trim() ?? "";
        const original = (project[f.key] as string) ?? "";
        if (val !== original) data[f.key] = val || null;
      }
      if (Object.keys(data).length === 0) {
        setEditing(false);
        return;
      }
      const res = await updateProject(project.id, data);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    });
  }

  function handleCancel() {
    const init: Record<string, string> = {};
    for (const f of FIELDS) init[f.key] = (project[f.key] as string) ?? "";
    setForm(init);
    setEditing(false);
    setError("");
  }

  const inputCls = "w-full rounded-md px-2.5 py-1.5 text-sm border outline-none focus:ring-1 transition-colors";
  const inputStyle = { background: "var(--background-secondary)", borderColor: "var(--border)", color: "var(--foreground)" };

  if (!editing) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Details</h2>
          <div className="flex items-center gap-2">
            {saved && <span className="text-[10px] font-medium" style={{ color: "#22c55e" }}>Saved</span>}
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors"
              style={{ background: "rgba(6,214,214,0.08)", color: "var(--accent-cyan)", border: "1px solid rgba(6,214,214,0.15)" }}
            >
              Edit
            </button>
          </div>
        </div>
        <dl className="space-y-3">
          <ReadRow label="Primary Domain" value={project.primaryDomain} />
          <ReadRow label="API Domain" value={project.apiDomain} />
          {project.publicWorkspaceUrl ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Public Workspace URL</dt>
              <dd className="text-sm mt-0.5">
                <a href={project.publicWorkspaceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-cyan)" }}>
                  {project.publicWorkspaceUrl}
                </a>
              </dd>
            </div>
          ) : (
            <ReadRow label="Public Workspace URL" value={null} />
          )}
          <ReadRow label="Customer Contact" value={project.customerContactName} />
          <ReadRow label="Contact Email" value={project.customerContactEmail} />
          {(project.jiraProjectKey || project.gitProvider || project.postmanWorkspaceId) && (
            <>
              <div className="pt-2 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "var(--foreground-dim)" }}>Integrations</p>
              </div>
              {project.jiraProjectKey && <ReadRow label="Jira Project" value={project.jiraProjectKey} />}
              {project.postmanWorkspaceId && <ReadRow label="Postman Workspace" value={project.postmanWorkspaceId} />}
              {project.gitProvider && (
                <ReadRow label="Git Repo" value={`${project.gitProvider}: ${project.gitRepoOwner || "—"}/${project.gitRepoName || "—"} (${project.gitBaseBranch || "main"})`} />
              )}
            </>
          )}
          <ReadRow label="Created" value={new Date(project.createdAt).toLocaleDateString()} />
          <ReadRow label="Evidence" value={evidenceSummary} />
        </dl>
      </div>
    );
  }

  const sections = [
    { id: "core", label: "Project Info" },
    { id: "contact", label: "Customer Contact" },
    { id: "integrations", label: "Integrations" },
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Edit Details</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="text-[10px] font-medium px-2.5 py-1 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-[10px] font-medium px-3 py-1 rounded-md transition-colors"
            style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
          {error}
        </div>
      )}

      <div className="space-y-5">
        {sections.map((section) => {
          const sectionFields = FIELDS.filter((f) => f.section === section.id);
          return (
            <div key={section.id}>
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "var(--foreground-dim)" }}>
                {section.label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sectionFields.map((f) => (
                  <div key={f.key}>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--foreground-muted)" }}>
                      {f.label}
                    </label>
                    <input
                      className={inputCls}
                      style={inputStyle}
                      type={f.type ?? "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</dt>
      <dd className="text-sm mt-0.5" style={{ color: "var(--foreground)" }}>{value || "—"}</dd>
    </div>
  );
}
