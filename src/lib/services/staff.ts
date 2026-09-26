import { now } from "@/lib/clock";
import { inTransaction, models } from "@/lib/db";
import { forbidden, invalid } from "@/lib/domain/errors";
import type { Ticket } from "@/lib/domain/types";
import { releaseFromStaff } from "@/lib/domain/workflow";
import { loadCtx, loadUser, notifyUsers, OPEN, saveOutcome } from "./repo";

/** Deactivating staff re-homes their open work in one transaction so nothing is left orphaned. */
export async function deactivateStaff(actorId: number, staffId: number): Promise<{ moved: number; queued: number }> {
  return inTransaction(async (t) => {
    const { UserModel, TicketModel } = models();
    const actor = await loadUser(actorId, t);
    if (actor?.role !== "MANAGER" || !actor.isActive) throw forbidden("Only managers can manage staff.");
    const target = await loadUser(staffId, t);
    if (!target || target.role !== "STAFF") throw invalid("That user is not a staff member.");
    if (!target.isActive) throw invalid(`${target.name} is already inactive.`);
    await UserModel.update({ isActive: false }, { where: { id: staffId }, transaction: t });

    const at = now();
    const tickets = await TicketModel.findAll({
      where: { assigneeId: staffId, status: OPEN },
      order: [["id", "ASC"]],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    const ctx = await loadCtx(actor, at, t);
    let queued = 0;
    for (const row of tickets) {
      const ticket = row.get({ plain: true }) as Ticket;
      const o = releaseFromStaff(ticket, staffId, ctx);
      if (o.ticket.assigneeId === null) queued++;
      await saveOutcome(t, ticket, o);
    }
    const summary = `${target.name} was deactivated: ${tickets.length} open ticket(s) released, ${queued} left unassigned`;
    await notifyUsers(t, ctx.managerIds.filter((id) => id !== actorId), summary, at);
    return { moved: tickets.length - queued, queued };
  });
}

export async function reactivateStaff(actorId: number, staffId: number): Promise<void> {
  const actor = await loadUser(actorId);
  if (actor?.role !== "MANAGER" || !actor.isActive) throw forbidden("Only managers can manage staff.");
  const { UserModel } = models();
  const [count] = await UserModel.update({ isActive: true }, { where: { id: staffId, role: "STAFF", isActive: false } });
  if (count !== 1) throw invalid("That staff member is already active.");
}
