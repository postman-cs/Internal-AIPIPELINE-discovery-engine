"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  reassignProject,
  setProjectStatus,
  setEngagementStage,
  createAdmiralTask,
  updateTaskStatus,
  deleteAdmiralTask,
  createAdmiralNote,
  toggleNotePin,
  deleteAdmiralNote,
} from "@/lib/actions/admin";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";

/* ── Types ─────────────────────────────────────────────────────────── */

interface ProjectRow {
  id: string;
  name: string;
  primaryDomain: string | null;
  status: string;
  engagementStage: number;
  completedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  _count: { phaseArtifacts: number; blockers: number; assumptions: number };
}

interface CseData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  projects: ProjectRow[];
  _count: { projects: number; ingestRuns: number };
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  author: { name: string };
  assignee: { id: string; name: string; email: string };
  project: { id: string; name: string } | null;
}

interface NoteRow {
  id: string;
  content: string;
  scope: string;
  phase: string | null;
  pinned: boolean;
  createdAt: Date;
  author: { name: string; email: string };
  project: { id: string; name: string } | null;
  cseUser: { id: string; name: string } | null;
}

interface CsePick { id: string; name: string; email: string }

interface Props {
  cse: CseData;
  cseList: CsePick[];
  tasks: TaskRow[];
  notes: NoteRow[];
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  completed: "#06d6d6",
  on_hold: "#f59e0b",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#64748b",
  medium: "#f59e0b",
  high: "#f97316",
  urgent: "#ef4444",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  completed: "#22c55e",
  cancelled: "#64748b",
};

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

/* ── Component ─────────────────────────────────────────────────────── */

export function CseDetailClient({ cse, cseList, tasks, notes }: Props) {
  const [tab, setTab] = useState<"projects" | "tasks" | "notes">("projects");
  const [pending, startTransition] = useTransition();

  /* ── Project actions ────────────────────────────────────────────── */

  function handleReassign(projectId: string, newOwnerId: string) {
    if (!newOwnerId || newOwnerId === cse.id) return;
    startTransition(async () => {
      await reassignProject(projectId, newOwnerId);
    });
  }

  function handleSetStatus(projectId: string, status: "active" | "completed" | "on_hold") {
    startTransition(async () => {
      await setProjectStatus(projectId, status);
    });
  }

  function handleStageChange(projectId: string, stage: number) {
    startTransition(async () => {
      await setEngagementStage(projectId, stage);
    });
  }

  /* ── Task actions ───────────────────────────────────────────────── */

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskDue, setTaskDue] = useState("");

  function handleCreateTask() {
    if (!taskTitle.trim()) return;
    startTransition(async () => {
      await createAdmiralTask({
        assigneeId: cse.id,
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        priority: taskPriority,
        projectId: taskProjectId || undefined,
        dueDate: taskDue || undefined,
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskPriority("medium");
      setTaskProjectId("");
      setTaskDue("");
    });
  }

  function handleTaskStatus(taskId: string, status: string) {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
    });
  }

  function handleDeleteTask(taskId: string) {
    startTransition(async () => {
      await deleteAdmiralTask(taskId);
    });
  }

  /* ── Note actions ───────────────────────────────────────────────── */

  const [noteContent, setNoteContent] = useState("");
  const [noteProjectId, setNoteProjectId] = useState("");

  function handleCreateNote() {
    if (!noteContent.trim()) return;
    startTransition(async () => {
      await createAdmiralNote({
        content: noteContent.trim(),
        cseUserId: cse.id,
        projectId: noteProjectId || undefined,
        scope: "cse",
      });
      setNoteContent("");
      setNoteProjectId("");
    });
  }

  function handlePinNote(noteId: string) {
    startTransition(async () => {
      await toggleNotePin(noteId);
    });
  }

  function handleDeleteNote(noteId: string) {
    startTransition(async () => {
      await deleteAdmiralNote(noteId);
    });
  }

  /* ── Derived data ───────────────────────────────────────────────── */

  const activeProjects = cse.projects.filter((p) => p.status === "active");
  const completedProjects = cse.projects.filter((p) => p.status === "completed");
  const totalBlockers = cse.projects.reduce((n, p) => n + p._count.blockers, 0);
  const totalPhases = cse.projects.reduce((n, p) => n + p._count.phaseArtifacts, 0);
  const openTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const doneTasks = tasks.filter((t) => t.status === "completed");

  const otherCses = cseList.filter((c) => c.id !== cse.id);

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admiral" className="text-xs mb-2 inline-block" style={{ color: "var(--accent-cyan)" }}>
          ← Back to Bridge
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
            {cse.name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{cse.name}</h1>
            <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{cse.email}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Active", value: activeProjects.length, color: "#22c55e" },
          { label: "Completed", value: completedProjects.length, color: "#06d6d6" },
          { label: "Blockers", value: totalBlockers, color: totalBlockers > 0 ? "#ef4444" : "#22c55e" },
          { label: "Phases", value: totalPhases, color: "#3b82f6" },
          { label: "Open Tasks", value: openTasks.length, color: openTasks.length > 0 ? "#f59e0b" : "#22c55e" },
        ].map((s) => (
          <div key={s.label} className="card-glow py-3 px-4">
            <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(["projects", "tasks", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              background: tab === t ? "rgba(201,162,39,0.12)" : "rgba(255,255,255,0.03)",
              color: tab === t ? "#c9a227" : "var(--foreground-dim)",
              border: tab === t ? "1px solid rgba(201,162,39,0.2)" : "1px solid transparent",
            }}
          >
            {t === "projects" ? `Projects (${cse.projects.length})` : t === "tasks" ? `Tasks (${tasks.length})` : `Notes (${notes.length})`}
          </button>
        ))}
      </div>

      {pending && (
        <div className="mb-4 px-3 py-2 rounded text-xs" style={{ background: "rgba(201,162,39,0.06)", color: "#c9a227" }}>
          Updating…
        </div>
      )}

      {/* ═══ PROJECTS TAB ═══ */}
      {tab === "projects" && (
        <div className="space-y-3">
          {cse.projects.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No projects assigned</p>
            </div>
          ) : (
            cse.projects.map((p) => {
              const stage = ENGAGEMENT_STAGES[p.engagementStage] ?? ENGAGEMENT_STAGES[0];
              return (
                <div key={p.id} className="card-glow p-4" style={{ opacity: p.status === "completed" ? 0.6 : 1 }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/projects/${p.id}`} className="font-semibold text-sm hover:underline truncate"
                          style={{ color: "var(--foreground)" }}>
                          {p.name}
                        </Link>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: `${STATUS_COLORS[p.status] || "#64748b"}15`, color: STATUS_COLORS[p.status] || "#64748b" }}>
                          {p.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: `${stage.color}15`, color: stage.color, border: `1px solid ${stage.color}25` }}>
                          S{p.engagementStage}: {stage.shortName}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                        {p.primaryDomain || "—"} · {p._count.phaseArtifacts} phases · {p._count.blockers} blockers · Updated {daysSince(p.updatedAt)}d ago
                      </p>

                      {/* Engagement Stage Pipeline */}
                      <div className="flex items-center gap-0.5 mt-2">
                        {ENGAGEMENT_STAGES.map((s) => (
                          <button
                            key={s.stage}
                            onClick={() => handleStageChange(p.id, s.stage)}
                            title={`${s.name}: ${s.definition}`}
                            className="h-2 flex-1 rounded-sm transition-all cursor-pointer hover:brightness-125"
                            style={{
                              background: s.stage <= p.engagementStage ? s.color : "rgba(255,255,255,0.06)",
                              opacity: s.stage <= p.engagementStage ? 1 : 0.4,
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px]" style={{ color: stage.color }}>
                          {stage.name}
                        </span>
                        {p.engagementStage < 6 && (
                          <span className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>
                            Next: {stage.triggerToAdvance}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Stage selector */}
                      <select
                        value={p.engagementStage}
                        onChange={(e) => handleStageChange(p.id, parseInt(e.target.value))}
                        className="text-xs rounded px-2 py-1"
                        style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                      >
                        {ENGAGEMENT_STAGES.map((s) => (
                          <option key={s.stage} value={s.stage}>S{s.stage}: {s.shortName}</option>
                        ))}
                      </select>

                      {/* Status toggle */}
                      <select
                        value={p.status}
                        onChange={(e) => handleSetStatus(p.id, e.target.value as "active" | "completed" | "on_hold")}
                        className="text-xs rounded px-2 py-1"
                        style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                      >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On Hold</option>
                      </select>

                      {/* Reassign */}
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          handleReassign(p.id, e.target.value);
                          e.target.value = "";
                        }}
                        className="text-xs rounded px-2 py-1"
                        style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                      >
                        <option value="" disabled>Move to…</option>
                        {otherCses.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TASKS TAB ═══ */}
      {tab === "tasks" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task list */}
          <div className="lg:col-span-2 space-y-3">
            {tasks.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No tasks assigned yet</p>
              </div>
            ) : (
              <>
                {openTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>
                      Open ({openTasks.length})
                    </h3>
                    {openTasks.map((t) => (
                      <div key={t.id} className="card-glow p-3 mb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[t.priority] || "#64748b" }} />
                              <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{t.title}</span>
                            </div>
                            {t.description && (
                              <p className="text-xs mt-1 ml-4" style={{ color: "var(--foreground-dim)" }}>{t.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 ml-4">
                              {t.project && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                                  {t.project.name}
                                </span>
                              )}
                              {t.dueDate && (
                                <span className="text-[10px]" style={{ color: "#f59e0b" }}>
                                  Due {new Date(t.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                                {new Date(t.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={t.status}
                              onChange={(e) => handleTaskStatus(t.id, e.target.value)}
                              className="text-[11px] rounded px-1.5 py-0.5"
                              style={{ background: `${TASK_STATUS_COLORS[t.status] || "#64748b"}12`, color: TASK_STATUS_COLORS[t.status] || "#64748b", border: "1px solid var(--border)" }}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <button onClick={() => handleDeleteTask(t.id)}
                              className="text-xs px-1 opacity-40 hover:opacity-100 transition-opacity"
                              style={{ color: "#ef4444" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {doneTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>
                      Completed ({doneTasks.length})
                    </h3>
                    {doneTasks.slice(0, 5).map((t) => (
                      <div key={t.id} className="card p-3 mb-2 opacity-50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs line-through" style={{ color: "var(--foreground-dim)" }}>{t.title}</span>
                          <button onClick={() => handleDeleteTask(t.id)}
                            className="text-xs px-1 opacity-40 hover:opacity-100" style={{ color: "#ef4444" }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Create task form */}
          <div className="card p-4 h-fit sticky top-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Assign Task</h3>
            <div className="space-y-3">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title…"
                className="w-full text-sm rounded px-3 py-2"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
              <textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Description (optional)…"
                rows={3}
                className="w-full text-xs rounded px-3 py-2 resize-none"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  className="text-xs rounded px-2 py-1.5"
                  style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="text-xs rounded px-2 py-1.5"
                  style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  <option value="">No project</option>
                  {cse.projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full text-xs rounded px-3 py-1.5"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
              <button
                onClick={handleCreateTask}
                disabled={!taskTitle.trim() || pending}
                className="w-full btn-primary text-sm py-2 disabled:opacity-40"
              >
                Assign Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NOTES TAB ═══ */}
      {tab === "notes" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2">
            {notes.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No notes for {cse.name} yet</p>
              </div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="card p-3"
                  style={{ border: n.pinned ? "1px solid rgba(201,162,39,0.2)" : undefined }}>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{n.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {n.project && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                          {n.project.name}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                        {n.author.name} · {new Date(n.createdAt).toLocaleDateString()}
                        {n.pinned && <span style={{ color: "#c9a227" }}> · Pinned</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePinNote(n.id)}
                        className="text-xs px-1 transition-opacity hover:opacity-100"
                        style={{ color: n.pinned ? "#c9a227" : "#64748b", opacity: n.pinned ? 1 : 0.5 }}>
                        {n.pinned ? "★" : "☆"}
                      </button>
                      <button onClick={() => handleDeleteNote(n.id)}
                        className="text-xs px-1 opacity-40 hover:opacity-100" style={{ color: "#ef4444" }}>✕</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Create note form */}
          <div className="card p-4 h-fit sticky top-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>Add Note for {cse.name}</h3>
            <div className="space-y-3">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write a note…"
                rows={4}
                className="w-full text-sm rounded px-3 py-2 resize-none"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
              <select
                value={noteProjectId}
                onChange={(e) => setNoteProjectId(e.target.value)}
                className="w-full text-xs rounded px-2 py-1.5"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                <option value="">General (no project)</option>
                {cse.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={handleCreateNote}
                disabled={!noteContent.trim() || pending}
                className="w-full btn-primary text-sm py-2 disabled:opacity-40"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
