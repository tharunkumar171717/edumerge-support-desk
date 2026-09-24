import { CAMPUS_TIMEZONE } from "@/lib/domain/config";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: CAMPUS_TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", { timeZone: CAMPUS_TIMEZONE, day: "numeric", month: "short", year: "numeric" });

export const fmtDateTime = (d: Date | null) => (d ? dateTime.format(d) : "—");
export const fmtDate = (s: string | null) => (s ? dateOnly.format(new Date(`${s}T00:00:00+05:30`)) : "—");

/** "3h 20m", "2d 4h"; sign handled by the caller. */
export function fmtDuration(ms: number): string {
  const m = Math.floor(Math.abs(ms) / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m % 60}m`;
}

export function fmtRemaining(ms: number | null): string {
  if (ms == null) return "";
  return ms >= 0 ? `${fmtDuration(ms)} left` : `${fmtDuration(ms)} overdue`;
}

export function fmtAge(from: Date, now: Date): string {
  return fmtDuration(now.getTime() - from.getTime());
}
