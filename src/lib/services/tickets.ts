import { now } from "@/lib/clock";
import { inTransaction, models, type Transaction } from "@/lib/db";
import type { Ctx, Outcome } from "@/lib/domain/draft";
import { forbidden, invalid } from "@/lib/domain/errors";
import type { Priority, Ticket, User } from "@/lib/domain/types";
import * as wf from "@/lib/domain/workflow";
import { insertOutcome, loadCtx, loadUser, lockTicket, OPEN, saveOutcome } from "./repo";

async function requireActor(actorId: number, t: Transaction): Promise<User> {
  const actor = await loadUser(actorId, t);
  if (!actor) throw forbidden("Your session is no longer valid. Please log in again.");
  return actor;
}

/** Lock the row, re-check everything against the fresh copy, and write ticket + audit + notifications atomically. */
function run(actorId: number, ticketId: number, apply: (t: Ticket, ctx: Ctx) => Outcome): Promise<Outcome> {
  return inTransaction(async (t) => {
    const [actor, ticket] = await Promise.all([requireActor(actorId, t), lockTicket(t, ticketId)]);
    const ctx = await loadCtx(actor, now(), t);
    const outcome = apply(ticket, ctx);
    await saveOutcome(t, ticket, outcome);
    return outcome;
  });
}

export type CreateResult = { ok: true; id: number } | { ok: false; duplicateOf: { id: number; subject: string } };

export async function createTicketFor(
  actorId: number,
  input: wf.CreateInput,
  opts: { createAnyway?: boolean } = {},
): Promise<CreateResult> {
  return inTransaction(async (t): Promise<CreateResult> => {
    const actor = await requireActor(actorId, t);
    if (!opts.createAnyway) {
      const { TicketModel } = models();
      const dup = await TicketModel.findOne({
        where: { studentId: actor.id, category: input.category, status: OPEN },
        attributes: ["id", "subject"],
        order: [["createdAt", "DESC"]],
        transaction: t,
      });
      if (dup) return { ok: false, duplicateOf: { id: dup.id, subject: dup.subject } };
    }
    const outcome = wf.createTicket(input, await loadCtx(actor, now(), t));
    return { ok: true, id: await insertOutcome(t, outcome) };
  });
}

export const pickUpTicket = (actorId: number, id: number, version: number) =>
  run(actorId, id, (t, c) => wf.pickUp(t, version, c));

export const assignTicket = (actorId: number, id: number, version: number, assigneeId: number) =>
  run(actorId, id, (t, c) => wf.assign(t, version, assigneeId, c));

export const startTicket = (actorId: number, id: number, version: number) =>
  run(actorId, id, (t, c) => wf.start(t, version, c));

export const requestInfoOnTicket = (actorId: number, id: number, version: number, message: string) =>
  run(actorId, id, (t, c) => wf.requestInfo(t, version, message, c));

export const commentOnTicket = (actorId: number, id: number, version: number, body: string, internal: boolean) =>
  run(actorId, id, (t, c) => wf.addComment(t, version, body, internal, c));

export const resolveTicket = (actorId: number, id: number, version: number, note: string) =>
  run(actorId, id, (t, c) => wf.resolve(t, version, note, c));

export const changeTicketPriority = (actorId: number, id: number, version: number, p: Priority, reason: string) =>
  run(actorId, id, (t, c) => wf.changePriority(t, version, p, reason, c));

export const cancelTicket = (actorId: number, id: number, version: number, reason: string) =>
  run(actorId, id, (t, c) => wf.cancel(t, version, reason, c));

export const closeTicket = (actorId: number, id: number, version: number) =>
  run(actorId, id, (t, c) => wf.confirmClose(t, version, c));

export const reopenTicket = (actorId: number, id: number, version: number, reason: string) =>
  run(actorId, id, (t, c) => wf.reopen(t, version, reason, c));

/** Marks the user's unread notifications read: all of them, or only those about one ticket. Returns how many changed. */
export async function markNotificationsRead(userId: number, ticketId?: number): Promise<number> {
  const { NotificationModel } = models();
  const [count] = await NotificationModel.update(
    { isRead: true },
    { where: { userId, isRead: false, ...(ticketId ? { ticketId } : {}) } },
  );
  return count;
}

export function assertValidId(id: unknown): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw invalid("Invalid id.");
  return n;
}
