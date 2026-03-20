import { prisma } from "@/lib/prisma";
import { getProject } from "@/lib/actions/projects";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { getMissionData } from "@/lib/actions/meetings";
import { MoonBaseWrapper } from "../MoonBaseWrapper";
import { TranscriptUploader } from "../TranscriptUploader";

export default async function MissionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const data = await getMissionData(projectId);
  if (!data) notFound();

  const meetingEntries = data.meetings.entries.map((e) => ({
    id: e.id,
    title: e.title,
    type: "meeting" as const,
    date: e.date,
  }));

  const sessionEntries = data.sessions.entries.map((e) => ({
    id: e.id,
    title: e.title,
    type: "working_session" as const,
    date: e.date,
  }));

  const totalMissions = meetingEntries.length + sessionEntries.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(168,85,247,0.15))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--foreground)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              Missions
            </h1>
            <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              Meetings & working sessions for {project.name}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MissionBadge
              label="Meetings"
              count={meetingEntries.length}
              color="#3b82f6"
              status={data.meetings.status}
            />
            <MissionBadge
              label="Sessions"
              count={sessionEntries.length}
              color="#a855f7"
              status={data.sessions.status}
            />
          </div>
        </div>
      </div>

      {/* Moon Base Animation */}
      <div className="mb-8">
        <MoonBaseWrapper
          meetings={meetingEntries}
          sessions={sessionEntries}
          projectName={data.projectName}
        />
      </div>

      {/* Transcript Uploader */}
      <div className="mb-8">
        <TranscriptUploader projectId={projectId} />
      </div>

      {/* Mission Log */}
      {totalMissions > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div
            className="px-5 py-3"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
          >
            <h3 className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
              Mission Log ({totalMissions})
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
            {[...data.meetings.entries, ...data.sessions.entries]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((entry) => {
                const isMeeting = entry.type === "meeting";
                const color = isMeeting ? "#3b82f6" : "#a855f7";
                return (
                  <div key={entry.id} className="px-5 py-3 flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${color}15`, color }}
                    >
                      {isMeeting ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{entry.title}</p>
                      <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                        {entry.date} {entry.attendees && `· ${entry.attendees}`}
                      </p>
                    </div>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ background: `${color}12`, color }}
                    >
                      {isMeeting ? "MTG" : "WRK"} · {entry.chunkCount} chunks
                    </span>
                    <span className="text-[9px] font-bold shrink-0" style={{ color: "#fbbf24" }}>+50 XP</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function MissionBadge({ label, count, color, status }: { label: string; count: number; color: string; status: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
      style={{ background: `${color}10`, border: `1px solid ${color}20` }}
    >
      <span className="text-[10px] font-bold" style={{ color }}>{count}</span>
      <span className="text-[9px] font-medium" style={{ color: `${color}aa` }}>{label}</span>
      {status === "CLEAN" && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
    </div>
  );
}
