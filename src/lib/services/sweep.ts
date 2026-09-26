import { col, Op } from "sequelize";
import { now as clockNow } from "@/lib/clock";
import { inTransaction, models } from "@/lib/db";
import { AUTO_CLOSE_AFTER_HOURS, WAITING_REMINDER_AFTER_HOURS } from "@/lib/domain/config";
import { sweepTicket } from "@/lib/domain/sweep";
import { loadCtx, lockTicket, OPEN, saveOutcome } from "./repo";

const HOUR = 3_600_000;

/**
 * Idempotent escalation and pending-action pass. Vercel has no background workers, so this runs
 * on page loads of the busiest pages and from a cron; running it twice changes nothing.
 */
export async function runSlaSweep(at: Date = clockNow()): Promise<{ changed: number }> {
  const { TicketModel } = models();
  const remindBefore = new Date(at.getTime() - WAITING_REMINDER_AFTER_HOURS * HOUR);
  const closeBefore = new Date(at.getTime() - AUTO_CLOSE_AFTER_HOURS * HOUR);
  const candidates = await TicketModel.findAll({
    attributes: ["id"],
    where: {
      [Op.or]: [
        // First response overdue, not yet escalated to L1.
        { status: OPEN, firstResponseAt: null, responseDueAt: { [Op.lt]: at }, escalationLevel: { [Op.lt]: 1 } },
        // Resolution overdue while the clock is running, not yet L2.
        { status: OPEN, pausedAt: null, resolutionDueAt: { [Op.lt]: at }, escalationLevel: { [Op.lt]: 2 } },
        // Waiting on the student too long, and no reminder since this pause began.
        {
          status: "WAITING_ON_STUDENT",
          pausedAt: { [Op.lt]: remindBefore },
          [Op.or]: [{ reminderSentAt: null }, { reminderSentAt: { [Op.lt]: col("paused_at") } }],
        },
        // Resolved but never confirmed: auto-close.
        { status: "RESOLVED", resolvedAt: { [Op.lt]: closeBefore } },
      ],
    },
    order: [["id", "ASC"]],
  });

  let changed = 0;
  for (const { id } of candidates) {
    // One short transaction per ticket so a slow sweep never holds many row locks.
    const didChange = await inTransaction(async (t) => {
      const ticket = await lockTicket(t, id);
      const o = sweepTicket(ticket, await loadCtx(null, at, t));
      if (!o) return false;
      await saveOutcome(t, ticket, o);
      return true;
    });
    if (didChange) changed++;
  }
  return { changed };
}

let lastRun = 0;

/** Page-load trigger, throttled per server instance; correctness never depends on it. */
export async function maybeRunSweep(): Promise<void> {
  const t = Date.now();
  if (t - lastRun < 60_000) return;
  lastRun = t;
  try {
    await runSlaSweep();
  } catch (e) {
    console.error("SLA sweep failed", e);
  }
}
