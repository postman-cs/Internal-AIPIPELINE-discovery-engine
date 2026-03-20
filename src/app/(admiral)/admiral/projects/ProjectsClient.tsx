"use client";

import { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import { createProject, deleteProject, assignProject, unassignProject, reassignProject } from "@/lib/actions/admin";
import { AdminFormWrapper, FormField } from "../AdminTable";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";
import { StageAdvanceButton } from "../StageAdvanceButton";

type ProjectRow = {
  id: string;
  name: string;
  primaryDomain: string | null;
  status: string;
  engagementStage: number;
  completedAt: Date | null;
  closedWonAt: Date | null;
  updatedAt: Date;
  owner: { name: string; email: string } | null;
  _count: {
    sourceDocuments: number;
    phaseArtifacts: number;
    discoveryArtifacts: number;
    assumptions: number;
    blockers: number;
  };
};
type UserOption = { id: string; name: string; email: string };

type Tab = "assigned" | "unassigned" | "completed";

export function ProjectsClient({ projects, users }: { projects: ProjectRow[]; users: UserOption[] }) {
  const [state, action, pending] = useActionState(createProject, null);
  const [tab, setTab] = useState<Tab>("assigned");
  const [stageFilter, setStageFilter] = useState<number | "all">("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const cseUsers = users.filter((u) => u.id !== "admiral");

  const unassignedProjects = projects.filter((p) => !p.owner);
  const assignedActive = projects.filter((p) => p.owner && p.status !== "completed" && p.engagementStage !== 6);
  const completedProjects = projects.filter((p) => p.status === "completed" || p.engagementStage === 6);

  const filtered = (tab === "unassigned" ? unassignedProjects : tab === "completed" ? completedProjects : assignedActive)
    .filter((p) => stageFilter === "all" || p.engagementStage === stageFilter);

  function handleAssign(projectId: string, cseId: string) {
    startTransition(async () => {
      const result = await assignProject(projectId, cseId);
      setAssigningId(null);
      if (result && "message" in result) {
        setFeedback(result.message as string);
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  function handleUnassign(projectId: string) {
    startTransition(async () => {
      await unassignProject(projectId);
      setFeedback("Project unassigned");
      setTimeout(() => setFeedback(null), 3000);
    });
  }

  function handleReassign(projectId: string, newCseId: string) {
    startTransition(async () => {
      await reassignProject(projectId, newCseId);
      setFeedback("Project reassigned");
      setTimeout(() => setFeedback(null), 3000);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Engagements</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            {projects.length} total · {assignedActive.length} active · {unassignedProjects.length} unassigned · {completedProjects.length} completed
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className="mb-4 px-4 py-2 rounded text-sm font-medium"
          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          {feedback}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1.5">
          {([
            { value: "assigned" as Tab, label: "Active", count: assignedActive.length, color: "#06d6d6" },
            { value: "unassigned" as Tab, label: "Unassigned", count: unassignedProjects.length, color: "#f59e0b" },
            { value: "completed" as Tab, label: "Completed", count: completedProjects.length, color: "#22c55e" },
          ]).map((f) => (
            <button
              key={f.value}
              onClick={() => setTab(f.value)}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: tab === f.value ? `${f.color}18` : "rgba(255,255,255,0.03)",
                color: tab === f.value ? f.color : "var(--foreground-dim)",
                border: tab === f.value ? `1px solid ${f.color}40` : "1px solid var(--border)",
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        <div className="h-5 w-px" style={{ background: "var(--border)" }} />

        <select
          value={stageFilter === "all" ? "all" : String(stageFilter)}
          onChange={(e) => setStageFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="input-field text-xs py-1.5 px-2"
          style={{ maxWidth: 180 }}
        >
          <option value="all">All Stages</option>
          {ENGAGEMENT_STAGES.map((s) => (
            <option key={s.stage} value={s.stage}>S{s.stage} — {s.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No projects match the current filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const stage = ENGAGEMENT_STAGES[p.engagementStage] ?? ENGAGEMENT_STAGES[0];
                const isCompleted = p.status === "completed" || p.engagementStage === 6;
                const isUnassigned = !p.owner;
                const isAssigning = assigningId === p.id;

                return (
                  <div
                    key={p.id}
                    className="card p-4 transition-all"
                    style={{
                      opacity: isCompleted ? 0.7 : 1,
                      borderLeft: isUnassigned ? "3px solid #f59e0b" : `3px solid ${stage.color}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link
                            href={`/projects/${p.id}`}
                            className="text-sm font-medium hover:underline"
                            style={{ color: "var(--foreground)" }}
                          >
                            {p.name}
                          </Link>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: `${stage.color}20`, color: stage.color }}
                          >
                            S{p.engagementStage} · {stage.shortName}
                          </span>
                          {!isCompleted && (
                            <StageAdvanceButton
                              projectId={p.id}
                              currentStage={p.engagementStage}
                              isUnassigned={isUnassigned}
                              cseUsers={cseUsers.map((u) => ({ id: u.id, name: u.name }))}
                            />
                          )}
                          {isUnassigned && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                            >
                              UNASSIGNED
                            </span>
                          )}
                          {isCompleted && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
                            >
                              COMPLETED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[10px] flex-wrap" style={{ color: "var(--foreground-dim)" }}>
                          <span>{p.primaryDomain ?? "No domain"}</span>
                          {p.owner ? (
                            <span>CSE: {p.owner.name}</span>
                          ) : (
                            <span style={{ color: "#f59e0b" }}>No CSE assigned</span>
                          )}
                          <span>{p._count.sourceDocuments} docs</span>
                          <span>{p._count.phaseArtifacts} phases</span>
                          <span>{p._count.blockers} blockers</span>
                          {p.completedAt && (
                            <span style={{ color: "#22c55e" }}>
                              Completed {new Date(p.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Inline assign dropdown */}
                        {isAssigning && (
                          <div className="mt-3 flex items-center gap-2">
                            <select
                              id={`assign-${p.id}`}
                              className="input-field text-xs py-1.5 px-2 flex-1"
                              style={{ maxWidth: 280 }}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) handleAssign(p.id, e.target.value);
                              }}
                              disabled={isPending}
                            >
                              <option value="" disabled>Select a CSE...</option>
                              {cseUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setAssigningId(null)}
                              className="text-[10px] px-2 py-1 rounded"
                              style={{ color: "var(--foreground-dim)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUnassigned && !isAssigning && (
                          <button
                            onClick={() => setAssigningId(p.id)}
                            className="text-[10px] px-2.5 py-1 rounded font-medium transition-colors"
                            style={{
                              background: "rgba(245,158,11,0.12)",
                              color: "#f59e0b",
                              border: "1px solid rgba(245,158,11,0.25)",
                            }}
                          >
                            Assign CSE
                          </button>
                        )}
                        {!isUnassigned && !isCompleted && (
                          <select
                            className="text-[10px] px-1.5 py-1 rounded bg-transparent"
                            style={{ color: "var(--foreground-dim)", border: "1px solid var(--border)", maxWidth: 110 }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value === "__unassign") handleUnassign(p.id);
                              else if (e.target.value) handleReassign(p.id, e.target.value);
                            }}
                          >
                            <option value="" disabled>Reassign...</option>
                            {cseUsers.filter((u) => u.id !== p.owner?.name).map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                            <option value="__unassign">— Unassign —</option>
                          </select>
                        )}
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-[10px] px-2 py-1 rounded transition-colors"
                          style={{
                            background: "rgba(6,214,214,0.08)",
                            color: "#06d6d6",
                            border: "1px solid rgba(6,214,214,0.15)",
                          }}
                        >
                          View
                        </Link>
                        <form action={async () => { await deleteProject(p.id); }}>
                          <button
                            type="submit"
                            className="text-xs px-1.5 py-1 rounded transition-colors hover:bg-white/5"
                            style={{ color: "var(--foreground-dim)" }}
                            title="Delete project"
                          >
                            ✕
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] mt-3 px-1" style={{ color: "var(--foreground-dim)" }}>
            {filtered.length} engagements · Updated {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-4">
          {/* CSE Workload Summary */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>CSE Workload</h3>
            <div className="space-y-1.5">
              {cseUsers
                .map((u) => ({
                  ...u,
                  count: projects.filter((p) => p.owner?.name === u.name && p.status !== "completed" && p.engagementStage !== 6).length,
                }))
                .sort((a, b) => b.count - a.count)
                .map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-[10px]">
                    <span style={{ color: "var(--foreground-dim)" }}>{u.name}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.max(8, u.count * 8)}px`,
                          background: u.count > 10 ? "#ef4444" : u.count > 6 ? "#f59e0b" : "#22c55e",
                        }}
                      />
                      <span
                        className="font-mono w-5 text-right"
                        style={{ color: u.count > 10 ? "#ef4444" : u.count > 6 ? "#f59e0b" : "var(--foreground-dim)" }}
                      >
                        {u.count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <AdminFormWrapper title="Create Engagement" action={action} state={state} pending={pending}>
            <FormField label="Customer Name" name="name" required placeholder="Acme Corp" />
            <FormField label="Primary Domain" name="primaryDomain" placeholder="acme.com" />
            <FormField
              label="Assign CSE (optional)" name="ownerUserId" type="select"
              options={[{ value: "", label: "— Unassigned —" }, ...cseUsers.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </AdminFormWrapper>
        </div>
      </div>
    </>
  );
}
