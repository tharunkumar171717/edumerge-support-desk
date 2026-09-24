import { now as clockNow } from "@/lib/clock";
import { sql } from "@/lib/db";
import { AUTO_CLOSE_AFTER_HOURS, WAITING_REMINDER_AFTER_HOURS } from "@/lib/domain/config";
import { sweepTicket } from "@/lib/domain/sweep";
import { loadCtx, lockTicket, OPEN, saveOutcome } from "./repo";

const HOUR = 3_600_000;

/**
 * Idempotent escalation and pending-action pass. Vercel has no background workers, so this runs
 * on page loads of the busiest pages and from a 15-minute cron; running it twice changes nothing.
 */
export async function runSlaSweep(at: Date = clockNow()): Promise<{ changed: number }> {
  const remindBefore = new Date(at.getTime() - WAITING_REMINDER_AFTER_HOURS * HOUR);
  const closeBefore = new Date(at.getTime() - AUTO_CLOSE_AFTER_HOURS * HOUR);
  const candidates = await sql<{ id: number }[]>`
    SELECT id FROM support_desk.tickets
     WHERE (status IN ${sql(OPEN)} AND first_response_at IS NULL AND response_due_at < ${at} AND escalation_level < 1)
        OR (status IN ${sql(OPEN)} AND paused_at IS NULL AND resolution_due_at < ${at} AND escalation_level < 2)
        OR (status = 'WAITING_ON_STUDENT' AND paused_at < ${remindBefore}
            AND (reminder_sent_at IS NULL OR reminder_sent_at < paused_at))
        OR (status = 'RESOLVED' AND resolved_at < ${closeBefore})
     ORDER BY id`;

  let changed = 0;
  for (const { id } of candidates) {
    // One short transaction per ticket so a slow sweep never holds many row locks.
    const didChange = await sql.begin(async (tx) => {
      const t = await lockTicket(tx, id);
      const o = sweepTicket(t, await loadCtx(tx, null, at));
      if (!o) return false;
      await saveOutcome(tx, t, o);
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
