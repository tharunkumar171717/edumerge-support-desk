import { Op, type Includeable, type WhereOptions } from "sequelize";
import { models, type TicketModel } from "@/lib/db";
import type { Catalog } from "@/lib/domain/catalog";
import { OPEN_STATUSES } from "@/lib/domain/config";
import { notFound } from "@/lib/domain/errors";
import { requireView } from "@/lib/domain/permissions";
import { resolutionClock, responseClock, worstSlaState } from "@/lib/domain/sla";
import { PRIORITIES, STATUSES, type Category, type Priority, type Role, type SlaStateName, type Status, type Ticket, type User } from "@/lib/domain/types";
import { getCatalog } from "./catalog";

/** A ticket plus the names and master-data labels the UI shows, loaded with joins (`include`). */
export type TicketRow = Ticket & {
  studentName: string;
  studentRollNo: string | null;
  assigneeName: string | null;
  categoryLabel: string;
  team: string;
  teamLabel: string;
  priorityLabel: string;
  priorityRank: number;
};

// Events that reveal internal handling are hidden from students, like internal notes.
const STAFF_ONLY_EVENTS = ["internal_note", "escalated", "queued"];

/** Joins for a TicketRow: student, assignee, category → team, priority. */
function ticketIncludes(): Includeable[] {
  const { UserModel, CategoryModel, TeamModel, PriorityModel } = models();
  return [
    { model: UserModel, as: "student", attributes: ["name", "rollNo"] },
    { model: UserModel, as: "assignee", attributes: ["name"] },
    { model: CategoryModel, as: "categoryRef", attributes: ["label", "teamCode"], include: [{ model: TeamModel, as: "teamRef", attributes: ["label"] }] },
    { model: PriorityModel, as: "priorityRef", attributes: ["label", "rank"] },
  ];
}

/** Flattens a ticket loaded with ticketIncludes() into the row shape the UI and API use. */
function toRow(m: TicketModel): TicketRow {
  const { student, assignee, categoryRef, priorityRef, ...t } = m.get({ plain: true }) as Ticket & {
    student: { name: string; rollNo: string | null };
    assignee: { name: string } | null;
    categoryRef: { label: string; teamCode: string; teamRef: { label: string } };
    priorityRef: { label: string; rank: number };
  };
  return {
    ...t,
    studentName: student.name,
    studentRollNo: student.rollNo,
    assigneeName: assignee?.name ?? null,
    categoryLabel: categoryRef.label,
    team: categoryRef.teamCode,
    teamLabel: categoryRef.teamRef.label,
    priorityLabel: priorityRef.label,
    priorityRank: priorityRef.rank,
  };
}

/** Row-level visibility, applied in the query so a student's list can never include someone else's ticket. */
function visibleTo(user: User, catalog: Catalog): WhereOptions {
  if (user.role === "MANAGER") return {};
  if (user.role === "STUDENT") return { studentId: user.id };
  const teamCategories = catalog.categories.filter((c) => c.team === user.team).map((c) => c.code);
  return { [Op.or]: [{ assigneeId: user.id }, { category: teamCategories }] };
}

export async function listVisibleTickets(user: User): Promise<TicketRow[]> {
  const { TicketModel } = models();
  const rows = await TicketModel.findAll({
    where: visibleTo(user, await getCatalog()),
    include: ticketIncludes(),
    order: [["createdAt", "DESC"]],
    limit: 1000,
  });
  return rows.map(toRow);
}

export interface TicketFilters {
  q?: string;
  status?: Status | "OPEN";
  category?: Category;
  priority?: Priority;
  assignee?: string; // id, or "none"
  sla?: SlaStateName;
  sort?: "newest" | "oldest" | "sla" | "priority" | "updated";
}

export const SLA_FILTER_STATES: SlaStateName[] = ["breached", "at_risk", "on_track", "paused", "met", "missed"];
export const SORTS = { newest: "Newest", oldest: "Oldest first", sla: "SLA urgency", priority: "Priority", updated: "Recently updated" } as const;

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Filters from a query string (page URL or API call); anything unrecognised is ignored. */
export function parseTicketFilters(sp: Record<string, string | string[] | undefined>): TicketFilters {
  return {
    q: typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined,
    status: pick(sp.status, [...STATUSES, "OPEN"] as const),
    // Category codes are master data; an unknown one just matches nothing.
    category: typeof sp.category === "string" && /^[A-Z0-9_]{1,40}$/.test(sp.category) ? sp.category : undefined,
    priority: pick(sp.priority, PRIORITIES),
    assignee: typeof sp.assignee === "string" && /^(none|\d+)$/.test(sp.assignee) ? sp.assignee : undefined,
    sla: pick(sp.sla, SLA_FILTER_STATES),
    sort: pick(sp.sort, Object.keys(SORTS) as (keyof typeof SORTS)[]),
  };
}

const OPEN_SET = new Set<Status>(OPEN_STATUSES);

/** Most urgent first: breached, then least time left; closed work sinks. */
export function slaUrgency(t: Ticket, now: Date): number {
  if (!OPEN_SET.has(t.status)) return Number.MAX_SAFE_INTEGER;
  const r = responseClock(t, now);
  const s = resolutionClock(t, now);
  const candidates = [s.remainingMs, r.state === "met" || r.state === "missed" ? null : r.remainingMs];
  const nums = candidates.filter((x): x is number => x != null);
  const base = nums.length ? Math.min(...nums) : Number.MAX_SAFE_INTEGER / 2;
  return s.state === "paused" ? base + 1e12 : base;
}

// The data set is one college's open queue, so filtering in memory keeps SLA filters exact.
export function applyFilters(rows: TicketRow[], f: TicketFilters, now: Date): TicketRow[] {
  const q = f.q?.trim().toLowerCase();
  const out = rows.filter((t) => {
    if (f.status === "OPEN" ? !OPEN_SET.has(t.status) : f.status && t.status !== f.status) return false;
    if (f.category && t.category !== f.category) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.assignee === "none" ? t.assigneeId !== null : f.assignee && String(t.assigneeId) !== f.assignee) return false;
    if (f.sla && worstSlaState(t, now) !== f.sla) return false;
    if (q) {
      const hay = `sr-${String(t.id).padStart(5, "0")} ${t.subject} ${t.description} ${t.studentName} ${t.studentRollNo ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorters: Record<NonNullable<TicketFilters["sort"]>, (a: TicketRow, b: TicketRow) => number> = {
    newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    oldest: (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    priority: (a, b) => b.priorityRank - a.priorityRank || slaUrgency(a, now) - slaUrgency(b, now),
    sla: (a, b) => slaUrgency(a, now) - slaUrgency(b, now),
  };
  return out.sort(sorters[f.sort ?? "newest"]);
}

export interface CommentView { id: number; authorId: number; authorName: string; authorRole: string; body: string; isInternal: boolean; createdAt: Date }
export interface EventView { id: number; actorName: string | null; kind: string; fromValue: string | null; toValue: string | null; note: string | null; createdAt: Date }

export async function getTicketDetail(user: User, id: number) {
  const { TicketModel, CommentModel, TicketEventModel, UserModel } = models();
  const student = user.role === "STUDENT";
  const [row, catalog] = await Promise.all([TicketModel.findByPk(id, { include: ticketIncludes() }), getCatalog()]);
  if (!row) throw notFound();
  const ticket = toRow(row);
  requireView(user, ticket, catalog);
  const [comments, events] = await Promise.all([
    CommentModel.findAll({
      where: { ticketId: id, ...(student ? { isInternal: false } : {}) },
      include: [{ model: UserModel, as: "author", attributes: ["name", "role"] }],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
    }),
    TicketEventModel.findAll({
      where: { ticketId: id, ...(student ? { kind: { [Op.notIn]: STAFF_ONLY_EVENTS } } : {}) },
      include: [{ model: UserModel, as: "actor", attributes: ["name"] }],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
    }),
  ]);
  return {
    ticket,
    comments: comments.map((c): CommentView => ({
      id: c.id, authorId: c.authorId, authorName: c.author!.name, authorRole: c.author!.role,
      body: c.body, isInternal: c.isInternal, createdAt: c.createdAt,
    })),
    events: events.map((e): EventView => ({
      id: e.id, actorName: e.actor?.name ?? null, kind: e.kind, fromValue: e.fromValue,
      toValue: e.toValue, note: e.note, createdAt: e.createdAt,
    })),
  };
}

export async function listActiveStaff() {
  const { UserModel, TeamModel } = models();
  const rows = await UserModel.findAll({
    where: { role: "STAFF", isActive: true },
    attributes: ["id", "name", "team"],
    include: [{ model: TeamModel, as: "teamRef", attributes: ["label", "sortOrder"] }],
    order: [[{ model: TeamModel, as: "teamRef" }, "sortOrder", "ASC"], ["name", "ASC"]],
  });
  return rows.map((u) => ({ id: u.id, name: u.name, team: u.team ?? "", teamLabel: u.teamRef?.label ?? u.team ?? "" }));
}

export async function listAllStaff() {
  const { UserModel } = models();
  const rows = await UserModel.findAll({ where: { role: "STAFF" }, attributes: ["id", "name"], order: [["name", "ASC"]] });
  return rows.map((u) => ({ id: u.id, name: u.name }));
}

const ROLE_ORDER: Record<Role, number> = { STUDENT: 0, STAFF: 1, MANAGER: 2 };

export async function listUsersForLogin(): Promise<(User & { teamLabel: string | null })[]> {
  const { UserModel, TeamModel } = models();
  const rows = await UserModel.findAll({
    attributes: ["id", "name", "email", "role", "team", "rollNo", "isActive"],
    include: [{ model: TeamModel, as: "teamRef", attributes: ["label", "sortOrder"] }],
  });
  return rows
    .map((u) => ({ u, teamOrder: u.teamRef?.sortOrder ?? -1 }))
    .sort((a, b) => ROLE_ORDER[a.u.role] - ROLE_ORDER[b.u.role] || a.teamOrder - b.teamOrder || a.u.id - b.u.id)
    .map(({ u }) => ({
      id: u.id, name: u.name, email: u.email, role: u.role, team: u.team,
      rollNo: u.rollNo, isActive: u.isActive, teamLabel: u.teamRef?.label ?? null,
    }));
}

export async function unreadCount(userId: number): Promise<number> {
  const { NotificationModel } = models();
  return NotificationModel.count({ where: { userId, isRead: false } });
}

export async function listNotifications(userId: number) {
  const { NotificationModel, TicketModel } = models();
  const rows = await NotificationModel.findAll({
    where: { userId },
    include: [{ model: TicketModel, as: "ticket", attributes: ["subject"] }],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: 100,
  });
  return rows.map((n) => ({
    id: n.id, ticketId: n.ticketId, message: n.message, isRead: n.isRead,
    createdAt: n.createdAt, subject: n.ticket?.subject ?? null,
  }));
}
