"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/lib/actions/projects";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateProjectForm() {
  const [state, action] = useActionState(createProjectAction, null);

  return (
    <form action={action} className="card">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        New Project
      </h2>

      {state?.error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Project Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="input-field"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label htmlFor="primaryDomain" className="label">
            Primary Domain
          </label>
          <input
            id="primaryDomain"
            name="primaryDomain"
            type="text"
            className="input-field"
            placeholder="acme.com"
          />
        </div>
        <div>
          <label htmlFor="apiDomain" className="label">
            API Domain
          </label>
          <input
            id="apiDomain"
            name="apiDomain"
            type="text"
            className="input-field"
            placeholder="api.acme.com"
          />
        </div>
        <div>
          <label htmlFor="publicWorkspaceUrl" className="label">
            Public Workspace URL
          </label>
          <input
            id="publicWorkspaceUrl"
            name="publicWorkspaceUrl"
            type="text"
            className="input-field"
            placeholder="https://www.postman.com/acme/workspace/..."
          />
        </div>
        <SubmitButton pendingText="Creating..." className="btn-primary w-full">
          Create Project
        </SubmitButton>
      </div>
    </form>
  );
}
