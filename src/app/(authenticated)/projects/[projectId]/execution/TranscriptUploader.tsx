"use client";

import { useState, useTransition } from "react";
import { ingestTranscript } from "@/lib/actions/meetings";

interface TranscriptUploaderProps {
  projectId: string;
}

export function TranscriptUploader({ projectId }: TranscriptUploaderProps) {
  const [type, setType] = useState<"meeting" | "working_session">("meeting");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    xp?: { points: number; newXp: number; leveledUp: boolean };
    entryCount?: number;
    error?: string;
  } | null>(null);

  const handleSubmit = () => {
    if (!title.trim() || !transcript.trim()) return;
    startTransition(async () => {
      const res = await ingestTranscript(projectId, {
        type,
        title: title.trim(),
        transcript: transcript.trim(),
        date,
        attendees: attendees.trim() || undefined,
      });
      setResult(res);
      if (res.success) {
        setTitle("");
        setTranscript("");
        setAttendees("");
      }
    });
  };

  const isMeeting = type === "meeting";
  const accentColor = isMeeting ? "#3b82f6" : "#a855f7";
  const accentBg = isMeeting ? "rgba(59,130,246," : "rgba(168,85,247,";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${accentBg}0.1)` }}
    >
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ background: `${accentBg}0.03)`, borderBottom: `1px solid ${accentBg}0.08)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: `${accentBg}0.1)`, color: accentColor }}
          >
            {isMeeting ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            )}
          </div>
          <h3 className="text-sm font-semibold" style={{ color: accentColor }}>
            Ingest Transcript
          </h3>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${accentBg}0.12)`, color: accentColor }}>
            +50 XP
          </span>
        </div>

        {/* Type toggle */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setType("meeting")}
            className="px-3 py-1.5 text-[10px] font-semibold transition-all"
            style={{
              background: isMeeting ? "rgba(59,130,246,0.15)" : "transparent",
              color: isMeeting ? "#3b82f6" : "var(--foreground-dim)",
            }}
          >
            Meeting
          </button>
          <button
            onClick={() => setType("working_session")}
            className="px-3 py-1.5 text-[10px] font-semibold transition-all"
            style={{
              background: !isMeeting ? "rgba(168,85,247,0.15)" : "transparent",
              color: !isMeeting ? "#a855f7" : "var(--foreground-dim)",
            }}
          >
            Working Session
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3" style={{ background: "var(--background)" }}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--foreground-dim)" }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMeeting ? "Discovery call with CTO" : "API testing workshop"}
              className="w-full rounded-md px-3 py-2 text-xs"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--foreground-dim)" }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-xs"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--foreground-dim)" }}>Attendees</label>
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Jason Rivera, Tom Park"
              className="w-full rounded-md px-3 py-2 text-xs"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--foreground-dim)" }}>
            Transcript / Notes
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            placeholder={isMeeting
              ? "Paste the full meeting transcript here. It will be ingested as evidence and cascade updates will flow to all downstream phases..."
              : "Paste the working session notes — what was configured, demoed, or pair-programmed. This feeds directly into the cascade..."
            }
            className="w-full rounded-md px-3 py-2 text-xs font-mono leading-relaxed resize-y"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              minHeight: 120,
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
            {transcript.length > 0 && (
              <span>{Math.ceil(transcript.length / 4)} est. tokens</span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isPending || !title.trim() || !transcript.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{
              background: `${accentBg}0.15)`,
              color: accentColor,
              border: `1px solid ${accentBg}0.2)`,
            }}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
                </svg>
                Ingesting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Launch {isMeeting ? "Meeting" : "Session"}
              </span>
            )}
          </button>
        </div>

        {result && (
          <div
            className="rounded-lg px-4 py-3 text-xs"
            style={{
              background: result.success ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${result.success ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
              color: result.success ? "#34d399" : "#f87171",
            }}
          >
            {result.success ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Transcript ingested &middot; cascade updated
                </span>
                <span className="font-bold" style={{ color: "#fbbf24" }}>
                  +{result.xp?.points} XP {result.xp?.leveledUp && "LEVEL UP!"}
                </span>
              </div>
            ) : (
              <span>{result.error}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
