import { sql } from "@/lib/db";
import { CATEGORY_CONFIG } from "@/lib/domain/config";
import { notFound } from "@/lib/domain/errors";
import { requireView } from "@/lib/domain/permissions";
import { resolutionClock, responseClock, worstSlaState } from "@/lib/domain/sla";
import { CATEGORIES, type Category, type Priority, type SlaStateName, type Status, type Ticket, type User } from "@/lib/domain/types";

export type TicketRow = Ticket & { studentName: string; studentRollNo: string | null; assigneeName: string | null };

// Events that reveal internal handling are hidden from students, like internal notes.
const STAFF_ONLY_EVENTS = ["internal_note", "escalated", "queued"];

function teamCategories(user: User): Category[] {
  return CATEGORIES.filter((c) => CATEGORY_CONFIG[c].team === user.team);
}

/** Row-level visibility, applied in SQL so a student's query can never return someone else's ticket. */
function visibleTo(user: User) {
  if (user.role === "MANAGER") return sql`true`;
  if (user.role === "STUDENT") return sql`t.student_id = ${user.id}`;
  const cats = teamCategories(user);
  return cats.length
    ? sql`(t.assignee_id = ${user.id} OR t.category IN ${sql(cats)})`
    : sql`t.assignee_id = ${user.id}`;
}

export async function listVisibleTickets(user: User): Promise<TicketRow[]> {
  return sql<TicketRow[]>`
    SELECT t.*, s.name AS student_name, s.roll_no AS student_roll_no, a.name AS assignee_name
      FROM support_desk.tickets t
      JOIN support_desk.users s ON s.id = t.student_id
      LEFT JOIN support_desk.users a ON a.id = t.assignee_id
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

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const OPEN_SET = new Set<Status>(["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_STUDENT"]);

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
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || slaUrgency(a, now) - slaUrgency(b, now),
    sla: (a, b) => slaUrgency(a, now) - slaUrgency(b, now),
  };
  return out.sort(sorters[f.sort ?? "newest"]);
}

export interface CommentView { id: number; authorId: number; authorName: string; authorRole: string; body: string; isInternal: boolean; createdAt: Date }
export interface EventView { id: number; actorName: string | null; kind: string; fromValue: string | null; toValue: string | null; note: string | null; createdAt: Date }

export async function getTicketDetail(user: User, id: number) {
  const [ticket] = await sql<TicketRow[]>`
    SELECT t.*, s.name AS student_name, s.roll_no AS student_roll_no, a.name AS assignee_name
      FROM support_desk.tickets t
      JOIN support_desk.users s ON s.id = t.student_id
      LEFT JOIN support_desk.users a ON a.id = t.assignee_id
     WHERE t.id = ${id}`;
  if (!ticket) throw notFound();
  requireView(user, ticket);
  const student = user.role === "STUDENT";
  const comments = await sql<CommentView[]>`
    SELECT c.id, c.author_id, u.name AS author_name, u.role AS author_role, c.body, c.is_internal, c.created_at
      FROM support_desk.comments c JOIN support_desk.users u ON u.id = c.author_id
     WHERE c.ticket_id = ${id} ${student ? sql`AND NOT c.is_internal` : sql``}
     ORDER BY c.created_at, c.id`;
  const events = await sql<EventView[]>`
    SELECT e.id, u.name AS actor_name, e.kind, e.from_value, e.to_value, e.note, e.created_at
      FROM support_desk.ticket_events e LEFT JOIN support_desk.users u ON u.id = e.actor_id
     WHERE e.ticket_id = ${id} ${student ? sql`AND e.kind NOT IN ${sql(STAFF_ONLY_EVENTS)}` : sql``}
     ORDER BY e.created_at, e.id`;
  return { ticket, comments, events };
}

export async function listActiveStaff() {
  return sql<{ id: number; name: string; team: string }[]>`
    SELECT id, name, team FROM support_desk.users WHERE role = 'STAFF' AND is_active ORDER BY team, name`;
}

export async function listAllStaff() {
  return sql<{ id: number; name: string }[]>`
    SELECT id, name FROM support_desk.users WHERE role = 'STAFF' ORDER BY name`;
}

export async function listUsersForLogin() {
  return sql<User[]>`
    SELECT id, name, email, role, team, roll_no, is_active FROM support_desk.users ORDER BY
      CASE role WHEN 'STUDENT' THEN 0 WHEN 'STAFF' THEN 1 ELSE 2 END, team NULLS FIRST, id`;
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
