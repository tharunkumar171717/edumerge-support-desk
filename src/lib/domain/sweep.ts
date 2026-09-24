import { AUTO_CLOSE_AFTER_HOURS, isOpen, WAITING_REMINDER_AFTER_HOURS } from "./config";
import { Draft, type Ctx, type Outcome } from "./draft";
import type { Ticket } from "./types";

const HOUR = 3_600_000;

/**
 * Escalation and pending-action rules for one ticket. Returns null when nothing is due, which is
 * what makes the sweep idempotent: every rule is guarded by a field the rule itself sets.
 */
export function sweepTicket(t: Ticket, ctx: Ctx): Outcome | null {
  const d = new Draft(t, { ...ctx, actor: null });
  const now = ctx.now.getTime();
  let statusChanged = false;

  if (isOpen(t.status) && !t.firstResponseAt && now > t.responseDueAt.getTime() && d.t.escalationLevel < 1) {
    d.t.escalationLevel = 1;
    d.event("escalated", "0", "1", "First-response SLA breached");
    d.notify([...ctx.managerIds, t.assigneeId], "Escalated: first-response SLA breached");
  }

  const running = isOpen(t.status) && !t.pausedAt;
  if (running && now > t.resolutionDueAt.getTime() && d.t.escalationLevel < 2) {
    d.event("escalated", String(d.t.escalationLevel), "2", "Resolution SLA breached");
    d.t.escalationLevel = 2;
    d.notify([...ctx.managerIds, t.assigneeId], "Escalated: resolution SLA breached");
  }

  if (
    t.status === "WAITING_ON_STUDENT" &&
    t.pausedAt &&
    now - t.pausedAt.getTime() > WAITING_REMINDER_AFTER_HOURS * HOUR &&
    (!t.reminderSentAt || t.reminderSentAt < t.pausedAt)
  ) {
    d.t.reminderSentAt = ctx.now;
    d.event("reminder_sent", null, null, `No reply for ${WAITING_REMINDER_AFTER_HOURS}h`);
    d.notify([t.studentId], "Reminder: staff are waiting for your reply");
  }

  if (t.status === "RESOLVED" && t.resolvedAt && now - t.resolvedAt.getTime() > AUTO_CLOSE_AFTER_HOURS * HOUR) {
    d.move("CLOSED", `Auto-closed: no response for ${AUTO_CLOSE_AFTER_HOURS}h`);
    d.t.closedAt = ctx.now;
    d.notify([t.studentId], "Your resolved request was closed automatically");
    statusChanged = true;
  }

  if (!d.events.length) return null;
  // Flags alone don't bump the version, so a sweep never makes an open form stale; status changes do.
  return d.done(statusChanged);
}
