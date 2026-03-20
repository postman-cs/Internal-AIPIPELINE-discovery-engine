"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createAdmiralNote, createAdmiralTask, updateTaskStatus } from "@/lib/actions/admin";

interface TaskRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: Date | null;
  assignee: { id: string; name: string };
  project: { id: string; name: string } | null;
}

interface NoteRow {
  id: string;
  content: string;
  pinned: boolean;
  createdAt: Date;
  author: { name: string };
}

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#6b7280",
};

export function DashboardQuickPanels({
  recentTasks,
  recentNotes,
}: {
  recentTasks: TaskRow[];
  recentNotes: NoteRow[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <TaskPanel tasks={recentTasks} />
      <NotePanel notes={recentNotes} />
    </div>
  );
}

function TaskPanel({ tasks }: { tasks: TaskRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [quickTitle, setQuickTitle] = useState("");

  const handleQuickStatus = (taskId: string, status: string) => {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
    });
  };

  const handleQuickCreate = () => {
    if (!quickTitle.trim()) return;
    startTransition(async () => {
      await createAdmiralTask({ title: quickTitle.trim(), assigneeId: "" });
      setQuickTitle("");
    });
  };

  return (
    <div
      className="card-glow p-5"
      style={{ borderTop: "2px solid rgba(59,130,246,0.4)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 12px rgba(59,130,246,0.15)" }}
          >
            <svg className="w-4 h-4" style={{ color: "#60a5fa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Open Tasks</h2>
            <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              {tasks.length} task{tasks.length !== 1 ? "s" : ""} needing attention
            </p>
          </div>
        </div>
        <Link
          href="/admiral/tasks"
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: "rgba(59,130,246,0.1)",
            color: "#60a5fa",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          View All →
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>All clear — no open tasks</p>
          <Link href="/admiral/tasks" className="text-xs mt-2 inline-block" style={{ color: "#60a5fa" }}>
            Assign a task →
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.slice(0, 6).map((task) => {
            const isOverdue =
              task.dueDate &&
              new Date(task.dueDate) < new Date() &&
              task.status !== "completed";
            return (
              <div
                key={task.id}
                className="flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors hover:bg-white/[0.03] group"
              >
                <button
                  onClick={() => handleQuickStatus(task.id, "completed")}
                  disabled={isPending}
                  className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all border hover:scale-110"
                  style={{
                    borderColor: PRIORITY_DOT[task.priority] ?? "#6b7280",
                    background: "transparent",
                  }}
                  title="Mark complete"
                >
                  <span className="w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "#22c55e" }} />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                      → {task.assignee.name}
                    </span>
                    {task.project && (
                      <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                        {task.project.name}
                      </span>
                    )}
                    {isOverdue && (
                      <span className="text-[9px] font-bold" style={{ color: "#ef4444" }}>OVERDUE</span>
                    )}
                  </div>
                </div>

                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PRIORITY_DOT[task.priority] ?? "#6b7280" }}
                  title={task.priority}
                />
              </div>
            );
          })}
          {tasks.length > 6 && (
            <Link href="/admiral/tasks" className="block text-center text-[10px] py-2" style={{ color: "#60a5fa" }}>
              +{tasks.length - 6} more open tasks
            </Link>
          )}
        </div>
      )}

      {/* Quick-create bar */}
      <div className="mt-4 flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickCreate()}
          className="input-field text-xs flex-1 py-2"
          placeholder="Quick task... (Enter to create)"
        />
        <Link
          href="/admiral/tasks"
          className="text-xs px-3 py-2 rounded-lg shrink-0 transition-colors"
          style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
        >
          + Full Form
        </Link>
      </div>
    </div>
  );
}

function NotePanel({ notes }: { notes: NoteRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [quickNote, setQuickNote] = useState("");

  const handleQuickCreate = () => {
    if (!quickNote.trim()) return;
    startTransition(async () => {
      await createAdmiralNote({ content: quickNote.trim(), scope: "dashboard" });
      setQuickNote("");
    });
  };

  return (
    <div
      className="card-glow p-5"
      style={{ borderTop: "2px solid rgba(201,162,39,0.4)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(201,162,39,0.12)", boxShadow: "0 0 12px rgba(201,162,39,0.15)" }}
          >
            <svg className="w-4 h-4" style={{ color: "#e5c84c" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Admiral&apos;s Notes</h2>
            <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              Recent dashboard notes
            </p>
          </div>
        </div>
        <Link
          href="/admiral/notes"
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: "rgba(201,162,39,0.1)",
            color: "#e5c84c",
            border: "1px solid rgba(201,162,39,0.2)",
          }}
        >
          View All →
        </Link>
      </div>

      {notes.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No dashboard notes yet</p>
          <Link href="/admiral/notes" className="text-xs mt-2 inline-block" style={{ color: "#e5c84c" }}>
            Write a note →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.slice(0, 5).map((note) => (
            <div
              key={note.id}
              className="p-2.5 rounded-lg text-xs"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: note.pinned
                  ? "1px solid rgba(201,162,39,0.2)"
                  : "1px solid transparent",
              }}
            >
              <p style={{ color: "var(--foreground-muted)" }}>
                {note.content.slice(0, 140)}
                {note.content.length > 140 ? "..." : ""}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                {note.author.name} · {note.createdAt.toLocaleDateString()}
                {note.pinned && (
                  <span style={{ color: "#c9a227" }}> · Pinned</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Quick-create bar */}
      <div className="mt-4 flex gap-2">
        <input
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickCreate()}
          className="input-field text-xs flex-1 py-2"
          placeholder="Quick note... (Enter to save)"
          disabled={isPending}
        />
        <button
          onClick={handleQuickCreate}
          disabled={isPending || !quickNote.trim()}
          className="text-xs px-3 py-2 rounded-lg shrink-0 transition-colors"
          style={{ background: "rgba(201,162,39,0.15)", color: "#e5c84c" }}
        >
          {isPending ? "..." : "+ Add"}
        </button>
      </div>
    </div>
  );
}
