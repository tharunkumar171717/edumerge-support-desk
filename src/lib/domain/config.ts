import type { Category, Priority, Status, Team } from "./types";

// Master data kept in code for the prototype; in production this would be admin-editable.
export const TEAM_LABELS: Record<Team, string> = {
  ACCOUNTS: "Accounts Office",
  ACADEMICS: "Academic Office",
  ADMIN_OFFICE: "Administration Office",
  EXAMS: "Examination Cell",
};

export const CATEGORY_CONFIG: Record<Category, { label: string; team: Team; priority: Priority }> = {
  FEES: { label: "Fees", team: "ACCOUNTS", priority: "MEDIUM" },
  ATTENDANCE: { label: "Attendance", team: "ACADEMICS", priority: "MEDIUM" },
  ID_CARD: { label: "ID Card", team: "ADMIN_OFFICE", priority: "LOW" },
  DOCUMENTS: { label: "Documents", team: "ADMIN_OFFICE", priority: "MEDIUM" },
  CERTIFICATES: { label: "Certificates", team: "EXAMS", priority: "HIGH" },
  OTHER: { label: "Other", team: "ADMIN_OFFICE", priority: "LOW" },
};

// Calendar hours: [first response, resolution].
export const SLA_HOURS: Record<Priority, [number, number]> = {
  URGENT: [2, 24],
  HIGH: [4, 48],
  MEDIUM: [8, 72],
  LOW: [24, 120],
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

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

export function teamForCategory(category: Category): Team {
  return CATEGORY_CONFIG[category].team;
}

export function isOpen(status: Status): boolean {
  return OPEN_STATUSES.includes(status);
}

export function ticketCode(id: number): string {
  return `SR-${String(id).padStart(5, "0")}`;
}
