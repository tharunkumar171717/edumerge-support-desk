import type { StaffLoad } from "@/lib/domain/assign";
import { OPEN_STATUSES } from "@/lib/domain/config";
import type { Ctx, Outcome } from "@/lib/domain/draft";
import { notFound, stale } from "@/lib/domain/errors";
import type { Ticket, User } from "@/lib/domain/types";
import type { Tx } from "@/lib/db";

type Q = Tx | typeof import("@/lib/db").sql;

export const OPEN = [...OPEN_STATUSES];

export async function loadUser(q: Q, id: number): Promise<User | null> {
  const [u] = await q<User[]>`
    SELECT id, name, email, role, team, roll_no, is_active FROM support_desk.users WHERE id = ${id}`;
  return u ?? null;
}

export async function lockTicket(tx: Tx, id: number): Promise<Ticket> {
  const [t] = await tx<Ticket[]>`SELECT * FROM support_desk.tickets WHERE id = ${id} FOR UPDATE`;
  if (!t) throw notFound();
  return t;
}

export async function loadStaffLoads(q: Q): Promise<StaffLoad[]> {
  return q<StaffLoad[]>`
    SELECT u.id, u.name, u.team, u.is_active,
           (SELECT count(*)::int FROM support_desk.tickets t
             WHERE t.assignee_id = u.id AND t.status IN ${q(OPEN)}) AS open_count
      FROM support_desk.users u
     WHERE u.role = 'STAFF'
     ORDER BY u.id`;
}

export async function loadCtx(q: Q, actor: User | null, now: Date): Promise<Ctx> {
  const staff = await loadStaffLoads(q);
  const managers = await q<{ id: number }[]>`
    SELECT id FROM support_desk.users WHERE role = 'MANAGER' AND is_active`;
  return { actor, now, staff, managerIds: managers.map((m) => m.id) };
}

const MUTABLE: (keyof Ticket)[] = [
  "assigneeId", "priority", "status", "updatedAt", "firstResponseAt", "resolvedAt", "closedAt",
  "slaStartAt", "responseDueAt", "resolutionDueAt", "pausedAt", "pausedSeconds", "escalationLevel",
  "reopenCount", "resolutionNote", "reminderSentAt", "version",
];

async function writeChildren(tx: Tx, ticketId: number, o: Outcome) {
  if (o.events.length) {
    await tx`INSERT INTO support_desk.ticket_events ${tx(o.events.map((e) => ({ ...e, ticketId })))}`;
  }
  if (o.comments.length) {
    await tx`INSERT INTO support_desk.comments ${tx(o.comments.map((c) => ({ ...c, ticketId })))}`;
  }
  if (o.notifications.length) {
    const rows = o.notifications.map((n) => ({ ...n, ticketId, createdAt: o.ticket.updatedAt }));
    await tx`INSERT INTO support_desk.notifications ${tx(rows)}`;
  }
}

/** Persist an action's outcome; the version guard is a second line of defence behind FOR UPDATE. */
export async function saveOutcome(tx: Tx, before: Ticket, o: Outcome): Promise<void> {
  const patch = Object.fromEntries(MUTABLE.map((k) => [k, o.ticket[k]]));
  const res = await tx`
    UPDATE support_desk.tickets SET ${tx(patch)}
     WHERE id = ${before.id} AND version = ${before.version}`;
  if (res.count !== 1) throw stale();
  await writeChildren(tx, before.id, o);
}

export async function insertOutcome(tx: Tx, o: Outcome): Promise<number> {
  const { id: _ignored, ...row } = o.ticket;
  void _ignored;
  const [{ id }] = await tx<{ id: number }[]>`INSERT INTO support_desk.tickets ${tx(row)} RETURNING id`;
  await writeChildren(tx, id, o);
  return id;
}

export async function notifyUsers(tx: Tx, userIds: number[], message: string, at: Date, ticketId: number | null = null) {
  if (!userIds.length) return;
  const rows = userIds.map((userId) => ({ userId, ticketId, message, createdAt: at }));
  await tx`INSERT INTO support_desk.notifications ${tx(rows)}`;
}
