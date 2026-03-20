"use client";

import { useState, useTransition } from "react";
import { createAdmiralNote, deleteAdmiralNote, toggleNotePin } from "@/lib/actions/admin";

interface NoteRow {
  id: string;
  content: string;
  scope: string;
  phase: string | null;
  pinned: boolean;
  createdAt: Date;
  author: { name: string; email: string };
  project: { id: string; name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

const PHASE_OPTIONS = [
  "DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN",
  "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION",
  "DEPLOYMENT_PLAN", "BUILD_LOG",
];

const SCOPE_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "project", label: "Project" },
  { value: "phase", label: "Phase" },
  { value: "cse", label: "CSE" },
];

export function NotesClient({ notes, projects }: { notes: NoteRow[]; projects: Project[] }) {
  const [content, setContent] = useState("");
  const [scope, setScope] = useState("dashboard");
  const [projectId, setProjectId] = useState("");
  const [phase, setPhase] = useState("");
  const [filter, setFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      const includeProject = scope === "project" || scope === "phase";
      await createAdmiralNote({
        content: content.trim(),
        projectId: includeProject ? projectId || undefined : undefined,
        phase: (scope === "phase" || (scope === "project" && phase)) ? phase || undefined : undefined,
        scope,
      });
      setContent("");
      setPhase("");
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => { await deleteAdmiralNote(id); });
  };

  const handlePin = (id: string) => {
    startTransition(async () => { await toggleNotePin(id); });
  };

  const filtered = filter === "all" ? notes : notes.filter((n) => n.scope === filter);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Admiral&apos;s Log</h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          {notes.length} notes across all scopes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes List */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {["all", ...SCOPE_OPTIONS.map((s) => s.value)].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  background: filter === f ? "rgba(201, 162, 39, 0.15)" : "rgba(255,255,255,0.03)",
                  color: filter === f ? "#e5c84c" : "var(--foreground-dim)",
                  border: filter === f ? "1px solid rgba(201, 162, 39, 0.3)" : "1px solid var(--border)",
                }}
              >
                {f === "all" ? "All" : SCOPE_OPTIONS.find((s) => s.value === f)?.label ?? f}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No notes found</p>
            </div>
          ) : (
            filtered.map((note) => (
              <div
                key={note.id}
                className="card p-4"
                style={{
                  borderColor: note.pinned ? "rgba(201, 162, 39, 0.2)" : undefined,
                  boxShadow: note.pinned ? "0 0 12px rgba(201, 162, 39, 0.05)" : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground-muted)" }}>
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--foreground-dim)" }}>
                        {note.scope}
                      </span>
                      {note.project && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e" }}>
                          {note.project.name}
                        </span>
                      )}
                      {note.phase && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(6, 214, 214, 0.1)", color: "#06d6d6" }}>
                          {note.phase}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                        {note.author.name} &middot; {note.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handlePin(note.id)}
                      className="text-xs px-1.5 py-1 rounded transition-colors"
                      style={{ color: note.pinned ? "#c9a227" : "var(--foreground-dim)" }}
                      title={note.pinned ? "Unpin" : "Pin"}
                    >
                      {note.pinned ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-xs px-1.5 py-1 rounded transition-colors"
                      style={{ color: "var(--foreground-dim)" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Note */}
        <div>
          <div className="card p-5 space-y-4 sticky top-6">
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>New Note</h3>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="input-field text-sm w-full"
              >
                {SCOPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {(scope === "project" || scope === "phase") && (
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input-field text-sm w-full"
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(scope === "phase" || scope === "project") && (
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>
                  Phase{scope === "project" ? " (optional)" : ""}
                </label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="input-field text-sm w-full"
                >
                  <option value="">
                    {scope === "project" ? "All phases" : "Select phase..."}
                  </option>
                  {PHASE_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input-field text-sm w-full"
                rows={4}
                placeholder="Write your note..."
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isPending || !content.trim()}
              className="btn-primary w-full text-sm py-2"
            >
              {isPending ? "Saving..." : "Add Note"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
