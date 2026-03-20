"use client";
import { relativeTime, isoTimestamp } from "@/lib/format";

export function TimeAgo({ date }: { date: Date | string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={isoTimestamp(d)} className="cursor-help">
      {relativeTime(d)}
    </time>
  );
}
