import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return "just now";
  if (diffMs < 3600000) return formatDistanceToNow(d, { addSuffix: true });
  if (isToday(d)) return `today at ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `yesterday at ${format(d, "h:mm a")}`;
  if (diffMs < 7 * 86400000) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, "MMM d, yyyy");
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy 'at' h:mm a");
}

export function isoTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}
