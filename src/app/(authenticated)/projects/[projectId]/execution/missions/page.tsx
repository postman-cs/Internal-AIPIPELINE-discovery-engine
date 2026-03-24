import { getProject } from "@/lib/actions/projects";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { getMissionData } from "@/lib/actions/meetings";
import { TranscriptUploader } from "../TranscriptUploader";

export default async function MissionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const data = await getMissionData(projectId);
  if (!data) notFound();

  const allEntries = [...data.meetings.entries, ...data.sessions.entries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const meetingCount = data.meetings.entries.length;
  const sessionCount = data.sessions.entries.length;
  const totalCount = meetingCount + sessionCount;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            Engagement Log
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Meetings and working sessions for {project.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill label="Meetings" count={meetingCount} color="#6366f1" status={data.meetings.status} />
          <StatusPill label="Sessions" count={sessionCount} color="#8b5cf6" status={data.sessions.status} />
        </div>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-3 gap-4 mb-8 rounded-xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(6,10,20,0.9), rgba(15,23,42,0.95))",
          border: "1px solid rgba(99,102,241,0.15)",
        }}
      >
        <StatBlock value={totalCount} label="Total Engagements" />
        <StatBlock value={meetingCount} label="Customer Meetings" />
        <StatBlock value={sessionCount} label="Working Sessions" />
      </div>

      {/* Transcript Uploader */}
      <div className="mb-8">
        <TranscriptUploader projectId={projectId} />
      </div>

      {/* Engagement Timeline */}
      {totalCount > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h3 className="text-xs font-semibold tracking-wide" style={{ color: "var(--foreground-muted)" }}>
              TIMELINE
            </h3>
            <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              {totalCount} {totalCount === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {allEntries.map((entry) => {
              const isMeeting = entry.type === "meeting";
              const color = isMeeting ? "#6366f1" : "#8b5cf6";
              return (
                <div key={entry.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.01] transition-colors">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: color, boxShadow: `0 0 8px ${color}40` }}
                    />
                  </div>

                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}10` }}
                  >
                    {isMeeting ? (
                      <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {entry.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                      {entry.date}
                      {entry.attendees && ` · ${entry.attendees}`}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-md font-medium"
                      style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}
                    >
                      {isMeeting ? "Meeting" : "Working Session"}
                    </span>
                    <span className="text-[10px] tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                      {entry.chunkCount} evidence chunks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalCount === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            No meetings or working sessions recorded yet.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>
            Upload a call transcript above to get started.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, count, color, status }: { label: string; count: number; color: string; status: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ background: `${color}08`, border: `1px solid ${color}15` }}
    >
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{count}</span>
      <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>{label}</span>
      {status === "CLEAN" && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
    </div>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}
