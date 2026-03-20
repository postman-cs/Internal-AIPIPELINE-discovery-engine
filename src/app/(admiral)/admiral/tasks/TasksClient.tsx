"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createAdmiralTask,
  updateTaskStatus,
  deleteAdmiralTask,
} from "@/lib/actions/admin";

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

interface User {
  id: string;
  name: string;
  email: string;
}

interface Project {
  id: string;
  name: string;
}

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  high: { label: "High", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  medium: { label: "Medium", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  low: { label: "Low", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
} as const;

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type FilterType = "all" | "pending" | "in_progress" | "completed" | "cancelled";
type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";

export function TasksClient({
  tasks,
  users,
  projects,
}: {
  tasks: TaskRow[];
  users: User[];
  projects: Project[];
}) {
  const [statusFilter, setStatusFilter] = useState<FilterType>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleCreate = () => {
    if (!title.trim() || !assigneeId) return;
    startTransition(async () => {
      await createAdmiralTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId,
        projectId: projectId || undefined,
        dueDate: dueDate || undefined,
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
    });
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    startTransition(async () => {
      await updateTaskStatus(taskId, newStatus);
    });
  };

  const handleDelete = (taskId: string) => {
    startTransition(async () => {
      await deleteAdmiralTask(taskId);
    });
  };

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (assigneeFilter && t.assignee.id !== assigneeFilter) return false;
    return true;
  });

  const openTasks = filtered.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const closedTasks = filtered.filter(
    (t) => t.status === "completed" || t.status === "cancelled",
  );

  const overdue = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < new Date() &&
      t.status !== "completed" &&
      t.status !== "cancelled",
  );

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Task Command
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            {tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length} open
            {" · "}{tasks.filter((t) => t.status === "completed").length} completed
            {overdue.length > 0 && (
              <span style={{ color: "#ef4444" }}>{" · "}{overdue.length} overdue</span>
            )}
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Pending", count: tasks.filter((t) => t.status === "pending").length, color: "#f59e0b" },
          { label: "In Progress", count: tasks.filter((t) => t.status === "in_progress").length, color: "#3b82f6" },
          { label: "Completed", count: tasks.filter((t) => t.status === "completed").length, color: "#22c55e" },
          { label: "Overdue", count: overdue.length, color: "#ef4444" },
        ].map((s) => (
          <div
            key={s.label}
            className="card-glow py-3 px-4 text-center"
          >
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--foreground-dim)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1.5">
          {(["all", "pending", "in_progress", "completed", "cancelled"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: statusFilter === f ? "rgba(201,162,39,0.15)" : "rgba(255,255,255,0.03)",
                color: statusFilter === f ? "#e5c84c" : "var(--foreground-dim)",
                border: statusFilter === f ? "1px solid rgba(201,162,39,0.3)" : "1px solid var(--border)",
              }}
            >
              {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="h-5 w-px" style={{ background: "var(--border)" }} />

        <div className="flex gap-1.5">
          {(["all", "critical", "high", "medium", "low"] as PriorityFilter[]).map((p) => {
            const cfg = p !== "all" ? PRIORITY_CONFIG[p] : null;
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className="text-xs px-2.5 py-1.5 rounded-full transition-colors"
                style={{
                  background: priorityFilter === p
                    ? (cfg?.bg ?? "rgba(201,162,39,0.15)")
                    : "rgba(255,255,255,0.03)",
                  color: priorityFilter === p
                    ? (cfg?.color ?? "#e5c84c")
                    : "var(--foreground-dim)",
                  border: priorityFilter === p
                    ? `1px solid ${cfg?.color ?? "rgba(201,162,39,0.3)"}40`
                    : "1px solid var(--border)",
                }}
              >
                {p === "all" ? "Any Priority" : cfg!.label}
              </button>
            );
          })}
        </div>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="input-field text-xs py-1.5 px-2"
          style={{ maxWidth: 160 }}
        >
          <option value="">All assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-2">
          {/* Open Tasks */}
          {openTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "var(--foreground-dim)" }}>
                Open ({openTasks.length})
              </p>
              {openTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  isPending={isPending}
                />
              ))}
            </div>
          )}

          {/* Closed Tasks */}
          {closedTasks.length > 0 && (
            <div className="space-y-2 mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "var(--foreground-dim)" }}>
                Closed ({closedTasks.length})
              </p>
              {closedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  isPending={isPending}
                  dimmed
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="card text-center py-16">
              <p className="text-lg font-semibold mb-1" style={{ color: "var(--foreground-muted)" }}>
                No tasks found
              </p>
              <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
                Create a task using the panel on the right
              </p>
            </div>
          )}
        </div>

        {/* Create Task Panel */}
        <div>
          <div className="card p-5 space-y-4 sticky top-6" style={{ borderColor: "rgba(59,130,246,0.15)" }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "#3b82f6", boxShadow: "0 0 8px rgba(59,130,246,0.4)" }}
              />
              Assign New Task
            </h3>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field text-sm w-full"
                placeholder="Task title..."
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field text-sm w-full"
                rows={3}
                placeholder="Optional details..."
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Assign To *</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="input-field text-sm w-full"
              >
                <option value="">Select CSE...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-field text-sm w-full"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-field text-sm w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--foreground-dim)" }}>Project (optional)</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="input-field text-sm w-full"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={isPending || !title.trim() || !assigneeId}
              className="btn-primary w-full text-sm py-2.5 font-medium"
            >
              {isPending ? "Assigning..." : "Assign Task"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TaskCard({
  task,
  onStatusChange,
  onDelete,
  isPending,
  dimmed,
}: {
  task: TaskRow;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  dimmed?: boolean;
}) {
  const pri =
    PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.medium;
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "completed" &&
    task.status !== "cancelled";

  return (
    <div
      className="card p-4 transition-all duration-150"
      style={{
        opacity: dimmed ? 0.55 : 1,
        borderLeft: `3px solid ${pri.color}`,
        boxShadow: isOverdue ? "0 0 12px rgba(239,68,68,0.08)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: pri.bg, color: pri.color }}
            >
              {pri.label}
            </span>
            {isOverdue && (
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
              >
                Overdue
              </span>
            )}
            {task.project && (
              <Link
                href={`/projects/${task.project.id}`}
                className="text-[10px] px-1.5 py-0.5 rounded hover:underline"
                style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
              >
                {task.project.name}
              </Link>
            )}
          </div>

          <p
            className="text-sm font-medium"
            style={{
              color: "var(--foreground)",
              textDecoration: dimmed ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>

          {task.description && (
            <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              → {task.assignee.name}
            </span>
            {task.dueDate && (
              <span
                className="text-[10px]"
                style={{ color: isOverdue ? "#ef4444" : "var(--foreground-dim)" }}
              >
                Due {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              by {task.author.name} · {task.createdAt.toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            disabled={isPending}
            className="input-field text-[11px] py-1 px-1.5"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={() => onDelete(task.id)}
            disabled={isPending}
            className="text-xs px-1.5 py-1 rounded transition-colors hover:bg-white/5"
            style={{ color: "var(--foreground-dim)" }}
            title="Delete task"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
