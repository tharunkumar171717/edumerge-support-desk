import { sql } from "@/lib/db";
import { OPEN_STATUSES } from "@/lib/domain/config";
import { notFound } from "@/lib/domain/errors";
import { requireView } from "@/lib/domain/permissions";
import { resolutionClock, responseClock, worstSlaState } from "@/lib/domain/sla";
import { PRIORITIES, STATUSES, type Category, type Priority, type SlaStateName, type Status, type Ticket, type User } from "@/lib/domain/types";
import { getCatalog } from "./catalog";

/** A ticket plus the names and master-data labels the UI shows, joined in SQL. */
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

// A function, not a constant: building a fragment at import time would open the DB client during `next build`.
const ticketRow = () => sql`
  SELECT t.*, s.name AS student_name, s.roll_no AS student_roll_no, a.name AS assignee_name,
         c.label AS category_label, c.team_code AS team, tm.label AS team_label,
         p.label AS priority_label, p.rank AS priority_rank
    FROM support_desk.tickets t
    JOIN support_desk.users s ON s.id = t.student_id
    LEFT JOIN support_desk.users a ON a.id = t.assignee_id
    JOIN support_desk.categories c ON c.code = t.category
    JOIN support_desk.teams tm ON tm.code = c.team_code
    JOIN support_desk.priorities p ON p.code = t.priority`;

/** Row-level visibility, applied in SQL so a student's query can never return someone else's ticket. */
function visibleTo(user: User) {
  if (user.role === "MANAGER") return sql`true`;
  if (user.role === "STUDENT") return sql`t.student_id = ${user.id}`;
  return user.team
    ? sql`(t.assignee_id = ${user.id} OR c.team_code = ${user.team})`
    : sql`t.assignee_id = ${user.id}`;
}

export async function listVisibleTickets(user: User): Promise<TicketRow[]> {
  return sql<TicketRow[]>`
    ${ticketRow()}
     WHERE ${visibleTo(user)}
     ORDER BY t.created_at DESC
     LIMIT 1000`;
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
  const student = user.role === "STUDENT";
  // Everything is fetched at once; comments and events are only returned after the view check.
  const [[ticket], catalog, comments, events] = await Promise.all([
    sql<TicketRow[]>`
    ${ticketRow()}
     WHERE t.id = ${id}`,
    getCatalog(),
    sql<CommentView[]>`
    SELECT c.id, c.author_id, u.name AS author_name, u.role AS author_role, c.body, c.is_internal, c.created_at
      FROM support_desk.comments c JOIN support_desk.users u ON u.id = c.author_id
     WHERE c.ticket_id = ${id} ${student ? sql`AND NOT c.is_internal` : sql``}
     ORDER BY c.created_at, c.id`,
    sql<EventView[]>`
    SELECT e.id, u.name AS actor_name, e.kind, e.from_value, e.to_value, e.note, e.created_at
      FROM support_desk.ticket_events e LEFT JOIN support_desk.users u ON u.id = e.actor_id
     WHERE e.ticket_id = ${id} ${student ? sql`AND e.kind NOT IN ${sql(STAFF_ONLY_EVENTS)}` : sql``}
     ORDER BY e.created_at, e.id`,
  ]);
  if (!ticket) throw notFound();
  requireView(user, ticket, catalog);
  return { ticket, comments, events };
}

export async function listActiveStaff() {
  return sql<{ id: number; name: string; team: string; teamLabel: string }[]>`
    SELECT u.id, u.name, u.team, tm.label AS team_label
      FROM support_desk.users u JOIN support_desk.teams tm ON tm.code = u.team
     WHERE u.role = 'STAFF' AND u.is_active
     ORDER BY tm.sort_order, u.name`;
}

export async function listAllStaff() {
  return sql<{ id: number; name: string }[]>`
    SELECT id, name FROM support_desk.users WHERE role = 'STAFF' ORDER BY name`;
}

export async function listUsersForLogin() {
  return sql<(User & { teamLabel: string | null })[]>`
    SELECT u.id, u.name, u.email, u.role, u.team, u.roll_no, u.is_active, tm.label AS team_label
      FROM support_desk.users u LEFT JOIN support_desk.teams tm ON tm.code = u.team
     ORDER BY CASE u.role WHEN 'STUDENT' THEN 0 WHEN 'STAFF' THEN 1 ELSE 2 END, tm.sort_order NULLS FIRST, u.id`;
}

export async function unreadCount(userId: number): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM support_desk.notifications WHERE user_id = ${userId} AND NOT is_read`;
  return r.n;
}

export async function listNotifications(userId: number) {
  return sql<{ id: number; ticketId: number | null; message: string; isRead: boolean; createdAt: Date; subject: string | null }[]>`
    SELECT n.id, n.ticket_id, n.message, n.is_read, n.created_at, t.subject
      FROM support_desk.notifications n LEFT JOIN support_desk.tickets t ON t.id = n.ticket_id
     WHERE n.user_id = ${userId}
     ORDER BY n.created_at DESC, n.id DESC LIMIT 100`;
}
