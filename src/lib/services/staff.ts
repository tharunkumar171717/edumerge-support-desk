import { now } from "@/lib/clock";
import { sql } from "@/lib/db";
import { forbidden, invalid } from "@/lib/domain/errors";
import type { Ticket } from "@/lib/domain/types";
import { releaseFromStaff } from "@/lib/domain/workflow";
import { loadCtx, loadUser, notifyUsers, OPEN, saveOutcome } from "./repo";

/** Deactivating staff re-homes their open work in one transaction so nothing is left orphaned. */
export async function deactivateStaff(actorId: number, staffId: number): Promise<{ moved: number; queued: number }> {
  return sql.begin(async (tx) => {
    const actor = await loadUser(tx, actorId);
    if (actor?.role !== "MANAGER" || !actor.isActive) throw forbidden("Only managers can manage staff.");
    const target = await loadUser(tx, staffId);
    if (!target || target.role !== "STAFF") throw invalid("That user is not a staff member.");
    if (!target.isActive) throw invalid(`${target.name} is already inactive.`);
    await tx`UPDATE support_desk.users SET is_active = false WHERE id = ${staffId}`;

    const at = now();
    const tickets = await tx<Ticket[]>`
      SELECT * FROM support_desk.tickets
       WHERE assignee_id = ${staffId} AND status IN ${tx(OPEN)}
       ORDER BY id FOR UPDATE`;
    const ctx = await loadCtx(tx, actor, at);
    let queued = 0;
    for (const t of tickets) {
      const o = releaseFromStaff(t, staffId, ctx);
      if (o.ticket.assigneeId === null) queued++;
      await saveOutcome(tx, t, o);
    }
    const summary = `${target.name} was deactivated: ${tickets.length} open ticket(s) released, ${queued} left unassigned`;
    await notifyUsers(tx, ctx.managerIds.filter((id) => id !== actorId), summary, at);
    return { moved: tickets.length - queued, queued };
  }) as Promise<{ moved: number; queued: number }>;
}

export async function reactivateStaff(actorId: number, staffId: number): Promise<void> {
  const actor = await loadUser(sql, actorId);
  if (actor?.role !== "MANAGER" || !actor.isActive) throw forbidden("Only managers can manage staff.");
  const res = await sql`
    UPDATE support_desk.users SET is_active = true WHERE id = ${staffId} AND role = 'STAFF' AND NOT is_active`;
  if (res.count !== 1) throw invalid("That staff member is already active.");
}
