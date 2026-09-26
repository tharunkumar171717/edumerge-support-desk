export const ROLES = ["STUDENT", "STAFF", "MANAGER"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_ON_STUDENT",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

// Codes from the support_desk.categories / teams tables, so new ones need no code change.
export type Category = string;
export type Team = string;

export type SlaStateName = "on_track" | "at_risk" | "breached" | "paused" | "met" | "missed" | "n/a";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  team: Team | null;
  rollNo: string | null;
  isActive: boolean;
}

export interface Ticket {
  id: number;
  studentId: number;
  assigneeId: number | null;
  category: Category;
  subject: string;
  description: string;
  priority: Priority;
  status: Status;
  neededBy: string | null; // YYYY-MM-DD, campus calendar date
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  slaStartAt: Date;
  responseDueAt: Date;
  resolutionDueAt: Date;
  pausedAt: Date | null;
  pausedSeconds: number;
  escalationLevel: number;
  reopenCount: number;
  resolutionNote: string | null;
  reminderSentAt: Date | null;
  version: number;
}

export interface TicketEvent {
  ticketId: number;
  actorId: number | null; // null = system
  kind: string;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: Date;
}

export interface NewComment {
  ticketId: number;
  authorId: number;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface NewNotification {
  userId: number;
  ticketId: number;
  message: string;
}
