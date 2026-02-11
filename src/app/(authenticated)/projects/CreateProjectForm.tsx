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
        <SubmitButton pendingText="Creating..." className="btn-primary w-full">
          Create Project
        </SubmitButton>
      </div>
    </form>
  );
}
