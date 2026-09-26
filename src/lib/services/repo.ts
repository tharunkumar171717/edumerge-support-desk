import { Op } from "sequelize";
import { models, type Transaction } from "@/lib/db";
import type { StaffLoad } from "@/lib/domain/assign";
import { OPEN_STATUSES } from "@/lib/domain/config";
import type { Ctx, Outcome } from "@/lib/domain/draft";
import { notFound, stale } from "@/lib/domain/errors";
import type { Ticket, User } from "@/lib/domain/types";
import { getCatalog } from "./catalog";

export const OPEN = [...OPEN_STATUSES];

const USER_FIELDS = ["id", "name", "email", "role", "team", "rollNo", "isActive"] as const;

export async function loadUser(id: number, transaction?: Transaction): Promise<User | null> {
  const { UserModel } = models();
  const u = await UserModel.findByPk(id, { attributes: [...USER_FIELDS], transaction });
  return u ? (u.get({ plain: true }) as User) : null;
}

/** SELECT … FOR UPDATE: concurrent actions on the same ticket wait their turn. */
export async function lockTicket(t: Transaction, id: number): Promise<Ticket> {
  const { TicketModel } = models();
  const row = await TicketModel.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!row) throw notFound();
  return row.get({ plain: true }) as Ticket;
}

/** Every staff member with their open-ticket count, for auto-assignment. */
export async function loadStaffLoads(transaction?: Transaction): Promise<StaffLoad[]> {
  const { UserModel, TicketModel } = models();
  const [staff, counts] = await Promise.all([
    UserModel.findAll({ where: { role: "STAFF" }, attributes: ["id", "name", "team", "isActive"], order: [["id", "ASC"]], transaction }),
    TicketModel.count({ where: { status: OPEN, assigneeId: { [Op.ne]: null } }, group: ["assigneeId"], transaction }),
  ]);
  const open = new Map(counts.map((c) => [Number(c.assigneeId), Number(c.count)]));
  return staff.map((s) => ({ id: s.id, name: s.name, team: s.team, isActive: s.isActive, openCount: open.get(s.id) ?? 0 }));
}

/** Everything a domain action needs besides the ticket: actor, clock, staff loads, managers, master data. */
export async function loadCtx(actor: User | null, now: Date, transaction?: Transaction): Promise<Ctx> {
  const { UserModel } = models();
  const [staff, managers, catalog] = await Promise.all([
    loadStaffLoads(transaction),
    UserModel.findAll({ where: { role: "MANAGER", isActive: true }, attributes: ["id"], transaction }),
    getCatalog(transaction),
  ]);
  return { actor, now, staff, managerIds: managers.map((m) => m.id), catalog };
}

const MUTABLE = [
  "assigneeId", "priority", "status", "updatedAt", "firstResponseAt", "resolvedAt", "closedAt",
  "slaStartAt", "responseDueAt", "resolutionDueAt", "pausedAt", "pausedSeconds", "escalationLevel",
  "reopenCount", "resolutionNote", "reminderSentAt", "version",
] as const satisfies readonly (keyof Ticket)[];

/** Audit events, comments and notifications produced by an action. */
async function writeChildren(t: Transaction, ticketId: number, o: Outcome) {
  const { TicketEventModel, CommentModel, NotificationModel } = models();
  if (o.events.length) await TicketEventModel.bulkCreate(o.events.map((e) => ({ ...e, ticketId })), { transaction: t });
  if (o.comments.length) await CommentModel.bulkCreate(o.comments.map((c) => ({ ...c, ticketId })), { transaction: t });
  if (o.notifications.length) {
    const rows = o.notifications.map((n) => ({ ...n, ticketId, createdAt: o.ticket.updatedAt }));
    await NotificationModel.bulkCreate(rows, { transaction: t });
  }
}

/** Persist an action's outcome; the version guard is a second line of defence behind FOR UPDATE. */
export async function saveOutcome(t: Transaction, before: Ticket, o: Outcome): Promise<void> {
  const { TicketModel } = models();
  const patch = Object.fromEntries(MUTABLE.map((k) => [k, o.ticket[k]]));
  const [count] = await TicketModel.update(patch, { where: { id: before.id, version: before.version }, transaction: t });
  if (count !== 1) throw stale();
  await writeChildren(t, before.id, o);
}

export async function insertOutcome(t: Transaction, o: Outcome): Promise<number> {
  const { TicketModel } = models();
  const { id: _ignored, ...row } = o.ticket;
  void _ignored;
  const created = await TicketModel.create(row, { transaction: t });
  await writeChildren(t, created.id, o);
  return created.id;
}

export async function notifyUsers(t: Transaction, userIds: number[], message: string, at: Date, ticketId: number | null = null) {
  if (!userIds.length) return;
  const { NotificationModel } = models();
  await NotificationModel.bulkCreate(userIds.map((userId) => ({ userId, ticketId, message, createdAt: at })), { transaction: t });
}
