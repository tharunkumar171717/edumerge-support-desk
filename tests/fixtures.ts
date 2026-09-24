import type { StaffLoad } from "@/lib/domain/assign";
import type { Ctx } from "@/lib/domain/draft";
import { computeDueDates } from "@/lib/domain/sla";
import type { Ticket, User } from "@/lib/domain/types";

export const T0 = new Date("2026-09-20T04:30:00Z"); // 10:00 IST
export const hours = (h: number, from = T0) => new Date(from.getTime() + h * 3_600_000);

export const student: User = { id: 1, name: "Aarav Sharma", email: "aarav@x", role: "STUDENT", team: null, rollNo: "CS21001", isActive: true };
export const otherStudent: User = { ...student, id: 2, name: "Diya Patel", email: "diya@x", rollNo: "CS21002" };
export const accounts1: User = { id: 10, name: "Ramesh Iyer", email: "ramesh@x", role: "STAFF", team: "ACCOUNTS", rollNo: null, isActive: true };
export const accounts2: User = { ...accounts1, id: 11, name: "Lakshmi Nair", email: "lakshmi@x" };
export const exams1: User = { id: 20, name: "Suresh Rao", email: "suresh@x", role: "STAFF", team: "EXAMS", rollNo: null, isActive: true };
export const manager: User = { id: 99, name: "Dr. Meera Krishnan", email: "dean@x", role: "MANAGER", team: null, rollNo: null, isActive: true };

export function staffPool(overrides: Partial<Record<number, Partial<StaffLoad>>> = {}): StaffLoad[] {
  return [accounts1, accounts2, exams1].map((u) => ({
    id: u.id,
    name: u.name,
    team: u.team,
    isActive: u.isActive,
    openCount: 0,
    ...overrides[u.id],
  }));
}

export function ctx(actor: User | null, now = T0, staff = staffPool()): Ctx {
  return { actor, now, staff, managerIds: [manager.id] };
}

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const base: Ticket = {
    id: 1,
    studentId: student.id,
    assigneeId: accounts1.id,
    category: "FEES",
    subject: "Fee receipt for Semester 3 not generated",
    description: "Paid on 3 Sep via UPI but no receipt.",
    priority: "MEDIUM",
    status: "ASSIGNED",
    neededBy: null,
    createdAt: T0,
    updatedAt: T0,
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    slaStartAt: T0,
    responseDueAt: T0,
    resolutionDueAt: T0,
    pausedAt: null,
    pausedSeconds: 0,
    escalationLevel: 0,
    reopenCount: 0,
    resolutionNote: null,
    reminderSentAt: null,
    version: 1,
  };
  const t = { ...base, ...overrides };
  const due = computeDueDates(t);
  return {
    ...t,
    responseDueAt: overrides.responseDueAt ?? due.responseDueAt,
    resolutionDueAt: overrides.resolutionDueAt ?? due.resolutionDueAt,
  };
}
