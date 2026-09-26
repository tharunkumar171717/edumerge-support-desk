import { now } from "@/lib/clock";
import { sql, type Tx } from "@/lib/db";
import type { Ctx, Outcome } from "@/lib/domain/draft";
import { forbidden, invalid } from "@/lib/domain/errors";
import type { Priority, Ticket, User } from "@/lib/domain/types";
import * as wf from "@/lib/domain/workflow";
import { insertOutcome, loadCtx, loadUser, lockTicket, OPEN, saveOutcome } from "./repo";

async function requireActor(q: Tx | typeof sql, actorId: number): Promise<User> {
  const actor = await loadUser(q, actorId);
  if (!actor) throw forbidden("Your session is no longer valid. Please log in again.");
  return actor;
}

/** Lock the row, re-check everything against the fresh copy, and write ticket + audit + notifications atomically. */
async function run(actorId: number, ticketId: number, apply: (t: Ticket, ctx: Ctx) => Outcome): Promise<Outcome> {
  return sql.begin(async (tx) => {
    const [actor, ticket] = await Promise.all([requireActor(tx, actorId), lockTicket(tx, ticketId)]);
    const ctx = await loadCtx(tx, actor, now());
    const outcome = apply(ticket, ctx);
    await saveOutcome(tx, ticket, outcome);
    return outcome;
  }) as Promise<Outcome>;
}

export type CreateResult = { ok: true; id: number } | { ok: false; duplicateOf: { id: number; subject: string } };

export async function createTicketFor(
  actorId: number,
  input: wf.CreateInput,
  opts: { createAnyway?: boolean } = {},
): Promise<CreateResult> {
  return sql.begin(async (tx) => {
    const actor = await requireActor(tx, actorId);
    if (!opts.createAnyway) {
      const [dup] = await tx<{ id: number; subject: string }[]>`
        SELECT id, subject FROM support_desk.tickets
         WHERE student_id = ${actor.id} AND category = ${input.category} AND status IN ${tx(OPEN)}
         ORDER BY created_at DESC LIMIT 1`;
      if (dup) return { ok: false as const, duplicateOf: dup };
    }
    const outcome = wf.createTicket(input, await loadCtx(tx, actor, now()));
    const id = await insertOutcome(tx, outcome);
    return { ok: true as const, id };
  }) as Promise<CreateResult>;
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
  const res = ticketId
    ? await sql`UPDATE support_desk.notifications SET is_read = true WHERE user_id = ${userId} AND ticket_id = ${ticketId} AND NOT is_read`
    : await sql`UPDATE support_desk.notifications SET is_read = true WHERE user_id = ${userId} AND NOT is_read`;
  return res.count;
}

export function assertValidId(id: unknown): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw invalid("Invalid id.");
  return n;
}
