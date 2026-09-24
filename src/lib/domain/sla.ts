import { AT_RISK_THRESHOLD, SLA_HOURS } from "./config";
import type { Priority, SlaStateName, Ticket } from "./types";

// Two clocks per ticket. First response runs from creation and is never paused.
// Resolution runs from slaStartAt (creation or last reopen), pauses while waiting on the
// student, and every paused second pushes the due date out by the same amount.

const HOUR = 3_600_000;

export function windowsMs(priority: Priority): { response: number; resolution: number } {
  const [r, s] = SLA_HOURS[priority];
  return { response: r * HOUR, resolution: s * HOUR };
}

type DueFields = Pick<Ticket, "priority" | "createdAt" | "slaStartAt" | "pausedSeconds">;

export function computeDueDates(t: DueFields): { responseDueAt: Date; resolutionDueAt: Date } {
  const w = windowsMs(t.priority);
  return {
    responseDueAt: new Date(t.createdAt.getTime() + w.response),
    resolutionDueAt: new Date(t.slaStartAt.getTime() + w.resolution + t.pausedSeconds * 1000),
  };
}

type PauseFields = Pick<Ticket, "pausedAt" | "pausedSeconds" | "resolutionDueAt">;

export function pause<T extends PauseFields>(t: T, now: Date): T {
  return t.pausedAt ? t : { ...t, pausedAt: now };
}

export function resume<T extends PauseFields>(t: T, now: Date): T {
  if (!t.pausedAt) return t;
  const pausedMs = Math.max(0, now.getTime() - t.pausedAt.getTime());
  const secs = Math.round(pausedMs / 1000);
  return {
    ...t,
    pausedAt: null,
    pausedSeconds: t.pausedSeconds + secs,
    resolutionDueAt: new Date(t.resolutionDueAt.getTime() + secs * 1000),
  };
}

export interface SlaClock {
  state: SlaStateName;
  due: Date | null;
  remainingMs: number | null; // negative when overdue
  usedRatio: number | null; // share of the window consumed, may exceed 1
}

function openClock(due: Date, windowMs: number, now: Date): SlaClock {
  const remainingMs = due.getTime() - now.getTime();
  const usedRatio = 1 - remainingMs / windowMs;
  let state: SlaStateName = "on_track";
  if (remainingMs < 0) state = "breached";
  else if (remainingMs < windowMs * AT_RISK_THRESHOLD) state = "at_risk";
  return { state, due, remainingMs, usedRatio };
}

type ClockFields = Pick<
  Ticket,
  "priority" | "status" | "firstResponseAt" | "responseDueAt" | "resolvedAt" | "resolutionDueAt" | "pausedAt"
>;

export function responseClock(t: ClockFields, now: Date): SlaClock {
  const due = t.responseDueAt;
  if (t.firstResponseAt) {
    return { state: t.firstResponseAt <= due ? "met" : "missed", due, remainingMs: null, usedRatio: null };
  }
  if (t.status === "CANCELLED" || t.status === "CLOSED") {
    return { state: "n/a", due, remainingMs: null, usedRatio: null };
  }
  return openClock(due, windowsMs(t.priority).response, now);
}

export function resolutionClock(t: ClockFields, now: Date): SlaClock {
  if (t.status === "CANCELLED") return { state: "n/a", due: null, remainingMs: null, usedRatio: null };
  if (t.resolvedAt) {
    const state = t.resolvedAt <= t.resolutionDueAt ? "met" : "missed";
    return { state, due: t.resolutionDueAt, remainingMs: null, usedRatio: null };
  }
  const windowMs = windowsMs(t.priority).resolution;
  if (t.pausedAt) {
    // Frozen at the moment of pausing; the live due date keeps sliding while paused.
    const remainingMs = t.resolutionDueAt.getTime() - t.pausedAt.getTime();
    const due = new Date(t.resolutionDueAt.getTime() + (now.getTime() - t.pausedAt.getTime()));
    return { state: "paused", due, remainingMs, usedRatio: 1 - remainingMs / windowMs };
  }
  return openClock(t.resolutionDueAt, windowMs, now);
}

const RANK: SlaStateName[] = ["breached", "missed", "at_risk", "paused", "on_track", "met", "n/a"];

/** Single chip for list views: the more urgent of the two clocks. */
export function worstSlaState(t: ClockFields, now: Date): SlaStateName {
  const states = [responseClock(t, now).state, resolutionClock(t, now).state];
  const open = !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status);
  // On an open ticket a missed first response is history; the live risk is the resolution clock.
  const relevant = open ? states.filter((s) => s !== "met" && s !== "missed") : states;
  const pool = relevant.length ? relevant : states;
  return pool.reduce((a, b) => (RANK.indexOf(a) <= RANK.indexOf(b) ? a : b));
}

export function isBreached(t: ClockFields, now: Date): boolean {
  const r = responseClock(t, now).state;
  const s = resolutionClock(t, now).state;
  return r === "breached" || s === "breached";
}
