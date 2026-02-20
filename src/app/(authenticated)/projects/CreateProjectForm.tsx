"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/lib/actions/projects";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateProjectForm() {
  const [state, action] = useActionState(createProjectAction, null);

  return (
    <form action={action} className="card">
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        New Project
      </h2>

      {state?.error && (
        <div
          className="text-sm rounded-lg px-3 py-2 mb-4"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.15)",
            color: "#f87171",
          }}
        >
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="label">Project Name *</label>
          <input id="name" name="name" type="text" required className="input-field" placeholder="Acme Corp" />
        </div>
        <div>
          <label htmlFor="primaryDomain" className="label">Primary Domain</label>
          <input id="primaryDomain" name="primaryDomain" type="text" className="input-field" placeholder="acme.com" />
        </div>
        <div>
          <label htmlFor="apiDomain" className="label">API Domain</label>
          <input id="apiDomain" name="apiDomain" type="text" className="input-field" placeholder="api.acme.com" />
        </div>
        <div>
          <label htmlFor="publicWorkspaceUrl" className="label">Public Workspace URL</label>
          <input id="publicWorkspaceUrl" name="publicWorkspaceUrl" type="text" className="input-field" placeholder="https://www.postman.com/acme/workspace/..." />
        </div>

        <div
          className="rounded-lg p-3 space-y-3"
          style={{ background: "rgba(6, 214, 214, 0.04)", border: "1px solid rgba(6, 214, 214, 0.1)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{"\uD83D\uDCE7"}</span>
            <span className="text-xs font-semibold" style={{ color: "var(--accent-cyan)" }}>
              Gmail Auto-Ingest
            </span>
          </div>
          <div>
            <label htmlFor="customerDomain" className="label">Customer Email Domain</label>
            <input
              id="customerDomain"
              name="customerDomain"
              type="text"
              className="input-field"
              placeholder="acme.com"
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--foreground-dim)" }}>
              If Gmail is connected, a filter will auto-capture emails from this domain into the project.
            </p>
          </div>
        </div>

        <div
          className="rounded-lg p-3 space-y-3"
          style={{ background: "rgba(96, 165, 250, 0.04)", border: "1px solid rgba(96, 165, 250, 0.1)" }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: "#60a5fa" }}>
              Jira Auto-Track
            </span>
          </div>
          <div>
            <label htmlFor="jiraProjectKey" className="label">Jira Project Key</label>
            <input
              id="jiraProjectKey"
              name="jiraProjectKey"
              type="text"
              className="input-field uppercase"
              placeholder="e.g. CSEBOOT"
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--foreground-dim)" }}>
              If Jira is connected, a ticket will be auto-created in this project. Leave blank to use your default.
            </p>
          </div>
        </div>

        <SubmitButton pendingText="Creating..." className="btn-primary w-full">
          Create Project
        </SubmitButton>
      </div>
    </form>
  );
}
