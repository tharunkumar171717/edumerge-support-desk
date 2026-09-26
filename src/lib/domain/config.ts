import type { Status } from "./types";

// Teams, categories and priorities (labels, routing, SLA hours) are master data in the database;
// see catalog.ts. What stays here is the workflow itself and its tuning constants.

export const STATUS_LABELS: Record<Status, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_ON_STUDENT: "Waiting on student",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const OPEN_STATUSES: readonly Status[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_STUDENT"];
export const TERMINAL_STATUSES: readonly Status[] = ["CLOSED", "CANCELLED"];

export const AT_RISK_THRESHOLD = 0.25;
export const URGENT_NEED_WINDOW_DAYS = 2;
export const WAITING_REMINDER_AFTER_HOURS = 48;
export const AUTO_CLOSE_AFTER_HOURS = 72;
export const CAMPUS_TIMEZONE = "Asia/Kolkata";

export function isOpen(status: Status): boolean {
  return OPEN_STATUSES.includes(status);
}

export function ticketCode(id: number): string {
  return `SR-${String(id).padStart(5, "0")}`;
}
