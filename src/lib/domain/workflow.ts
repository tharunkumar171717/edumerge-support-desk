import { isOpen } from "./config";
import { Draft, type Ctx, type Outcome } from "./draft";
import { forbidden, invalid } from "./errors";
import {
  canAssign,
  canCancel,
  canComment,
  canConfirmOrReopen,
  canPickUp,
  canWork,
} from "./permissions";
import { initialPriority } from "./priority";
import { computeDueDates, pause, resume } from "./sla";
import type { Category, Priority, Ticket } from "./types";

export interface CreateInput {
  category: Category;
  subject: string;
  description: string;
  neededBy: string | null;
}

export function createTicket(input: CreateInput, ctx: Ctx): Outcome {
  const actor = ctx.actor;
  if (!actor || actor.role !== "STUDENT") throw forbidden("Only students can raise requests.");
  if (!ctx.catalog.category(input.category).isActive) throw invalid("That category is no longer available. Choose another.");
  const now = ctx.now;
  const priority = initialPriority(ctx.catalog, input.category, input.neededBy, now);
  const base = { priority, createdAt: now, slaStartAt: now, pausedSeconds: 0 };
  const ticket: Ticket = {
    id: 0,
    studentId: actor.id,
    assigneeId: null,
    category: input.category,
    subject: input.subject,
    description: input.description,
    priority,
    status: "NEW",
    neededBy: input.neededBy,
    createdAt: now,
    updatedAt: now,
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    slaStartAt: now,
    ...computeDueDates(base, ctx.catalog),
    pausedAt: null,
    pausedSeconds: 0,
    escalationLevel: 0,
    reopenCount: 0,
    resolutionNote: null,
    reminderSentAt: null,
    version: 1,
  };
  const d = new Draft(ticket, ctx);
  d.event("created", null, ctx.catalog.priorityLabel(priority), input.neededBy ? `Needed by ${input.neededBy}` : null);
  d.autoAssign();
  return d.done(false);
}

export function pickUp(t: Ticket, version: number, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (!canPickUp(d.actor, t, ctx.catalog)) throw forbidden("You can only pick up unassigned tickets from your own team.");
  d.checkVersion(version);
  d.t.assigneeId = d.actor.id;
  if (t.status === "NEW") d.move("ASSIGNED");
  d.event("picked_up", null, d.actor.name);
  return d.done();
}

export function assign(t: Ticket, version: number, assigneeId: number, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (!canAssign(d.actor, t)) throw forbidden("Only managers can assign open tickets.");
  d.checkVersion(version);
  const target = ctx.staff.find((s) => s.id === assigneeId);
  if (!target || !target.isActive) throw invalid("Choose an active staff member.");
  if (t.assigneeId === assigneeId) throw invalid(`${target.name} already owns this ticket.`);
  const previous = t.assigneeId;
  d.t.assigneeId = assigneeId;
  if (t.status === "NEW" || t.status === "IN_PROGRESS") d.move("ASSIGNED", "Reassigned");
  d.event("assigned", d.staffName(previous), target.name);
  d.notify([assigneeId], "A ticket was assigned to you");
  d.notify([previous], "A ticket you owned was reassigned");
  return d.done();
}

function requireWork(d: Draft, t: Ticket) {
  if (!canWork(d.actor, t)) throw forbidden("Only the ticket owner or a manager can do that.");
  if (!isOpen(t.status)) throw invalid("This ticket is no longer open.");
}

export function start(t: Ticket, version: number, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  requireWork(d, t);
  d.checkVersion(version);
  d.move("IN_PROGRESS");
  d.markFirstResponse();
  d.notify([t.studentId], "Staff started working on your request");
  return d.done();
}

export function requestInfo(t: Ticket, version: number, message: string, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  requireWork(d, t);
  d.checkVersion(version);
  if (!message.trim()) throw invalid("Tell the student what you need.");
  d.move("WAITING_ON_STUDENT", "Resolution SLA paused");
  d.t = pause(d.t, d.now);
  d.t.reminderSentAt = null;
  d.comment(message.trim(), false);
  d.markFirstResponse();
  d.notify([t.studentId], "Staff need more information from you");
  return d.done();
}

export function addComment(t: Ticket, version: number, body: string, internal: boolean, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (!canComment(d.actor, t, internal)) {
    throw forbidden(internal ? "You can't add internal notes here." : "You can't comment on this ticket.");
  }
  d.checkVersion(version);
  const text = body.trim();
  if (!text) throw invalid("Write a message first.");
  d.comment(text, internal);
  if (internal) {
    d.event("internal_note");
    return d.done();
  }
  if (d.actor.role === "STUDENT") {
    if (t.status === "WAITING_ON_STUDENT") {
      d.t = resume(d.t, d.now);
      d.move(t.assigneeId ? "IN_PROGRESS" : "NEW", "Student replied, SLA resumed");
    } else {
      d.event("commented");
    }
    d.notify(t.assigneeId ? [t.assigneeId] : ctx.managerIds, "The student replied on a ticket");
  } else {
    d.event("commented");
    d.markFirstResponse();
    d.notify([t.studentId], "Staff replied to your request");
  }
  return d.done();
}

export function resolve(t: Ticket, version: number, note: string, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  requireWork(d, t);
  d.checkVersion(version);
  if (!note.trim()) throw invalid("A resolution note is required.");
  d.t = resume(d.t, d.now);
  d.move("RESOLVED", note.trim());
  d.t.resolvedAt = d.now;
  d.t.resolutionNote = note.trim();
  d.markFirstResponse();
  d.notify([t.studentId], "Your request was resolved. Please confirm or reopen it");
  return d.done();
}

export function changePriority(t: Ticket, version: number, priority: Priority, reason: string, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  requireWork(d, t);
  d.checkVersion(version);
  if (priority === t.priority) throw invalid("That is already the priority.");
  if (!reason.trim()) throw invalid("Give a reason for changing the priority.");
  const { catalog } = ctx;
  d.t.priority = catalog.priority(priority).code;
  Object.assign(d.t, computeDueDates(d.t, catalog));
  d.event("priority_changed", catalog.priorityLabel(t.priority), catalog.priorityLabel(priority), reason.trim());
  return d.done();
}

export function cancel(t: Ticket, version: number, reason: string, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (!canCancel(d.actor, t)) throw forbidden("You can only cancel your own request before work starts.");
  d.checkVersion(version);
  d.move("CANCELLED", reason.trim() || null);
  d.t.closedAt = d.now;
  d.notify([t.assigneeId], "A student cancelled their request");
  return d.done();
}

export function confirmClose(t: Ticket, version: number, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (!canConfirmOrReopen(d.actor, t)) throw forbidden("Only the student can confirm a resolved request.");
  d.checkVersion(version);
  d.move("CLOSED", "Confirmed by student");
  d.t.closedAt = d.now;
  d.notify([t.assigneeId], "The student confirmed the resolution");
  return d.done();
}

export function reopen(t: Ticket, version: number, reason: string, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (!canConfirmOrReopen(d.actor, t)) throw forbidden("Only the student can reopen a resolved request.");
  d.checkVersion(version);
  if (!reason.trim()) throw invalid("Tell us why the issue isn't fixed.");
  // A reopen is a fresh resolution window, as if newly raised; escalation starts over.
  Object.assign(d.t, {
    slaStartAt: d.now,
    pausedAt: null,
    pausedSeconds: 0,
    resolvedAt: null,
    resolutionNote: null,
    escalationLevel: 0,
    reminderSentAt: null,
    reopenCount: t.reopenCount + 1,
  });
  d.t.resolutionDueAt = computeDueDates(d.t, ctx.catalog).resolutionDueAt;
  d.comment(`Reopened: ${reason.trim()}`, false);
  d.event("reopened", null, String(d.t.reopenCount), reason.trim());
  d.notify([t.assigneeId], "A student reopened a ticket you resolved");
  d.autoAssign();
  return d.done();
}

/** Owner deactivated: send active work back to the queue, then try to re-home it in the same team. */
export function releaseFromStaff(t: Ticket, staffId: number, ctx: Ctx): Outcome {
  const d = new Draft(t, ctx);
  if (t.assigneeId !== staffId || !isOpen(t.status)) throw invalid("Ticket is not owned by this staff member.");
  d.t.assigneeId = null;
  if (t.status === "ASSIGNED" || t.status === "IN_PROGRESS") d.move("NEW", "Owner deactivated");
  d.event("unassigned", d.staffName(staffId), null, "Owner deactivated");
  d.autoAssign(staffId);
  return d.done();
}
