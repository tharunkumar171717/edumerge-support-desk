import { now as clockNow } from "@/lib/clock";
import { isOpen } from "@/lib/domain/config";
import { DomainError } from "@/lib/domain/errors";
import { availableActions } from "@/lib/domain/permissions";
import { resolutionClock, responseClock, worstSlaState } from "@/lib/domain/sla";
import { getCatalog } from "@/lib/services/catalog";
import { applyFilters, getTicketDetail, listVisibleTickets, parseTicketFilters } from "@/lib/services/queries";
import { maybeRunSweep } from "@/lib/services/sweep";
import * as ticketService from "@/lib/services/tickets";
import { HttpError } from "../core/errors";
import type { Controller } from "../core/router";
import { userOf } from "../middlewares/auth.middleware";
import type { CreateTicketBody, TicketActionBody } from "../validators/tickets.validator";

/**
 * GET /api/tickets?status=&category=&priority=&assignee=&sla=&sort=&q= : tickets the caller may see.
 * `total` is every visible ticket; `counts` applies every filter except status, per status tab.
 */
export const listTickets: Controller = async (ctx) => {
  const user = userOf(ctx);
  await maybeRunSweep();
  const now = clockNow();
  const filters = parseTicketFilters(Object.fromEntries(ctx.query));
  const all = await listVisibleTickets(user);
  const rows = applyFilters(all, filters, now);
  const base = applyFilters(all, { ...filters, status: undefined }, now);
  const byStatus: Record<string, number> = {};
  for (const t of base) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  return Response.json({
    tickets: rows.map((t) => ({ ...t, slaState: worstSlaState(t, now) })),
    total: all.length,
    counts: { all: base.length, open: base.filter((t) => isOpen(t.status)).length, byStatus },
  });
};

/** POST /api/tickets: 201 { id }, or 409 DUPLICATE when the student already has an open ticket in that category. */
export const createTicket: Controller = async (ctx) => {
  const user = userOf(ctx);
  const { neededBy, createAnyway, ...input } = ctx.body as CreateTicketBody;
  const res = await ticketService.createTicketFor(user.id, { ...input, neededBy: neededBy ?? null }, { createAnyway: !!createAnyway });
  if (!res.ok) {
    throw new HttpError(409, "DUPLICATE", "You already have an open request in this category.", { duplicateOf: res.duplicateOf });
  }
  return Response.json({ id: res.id }, { status: 201, headers: { Location: `/api/tickets/${res.id}` } });
};

/** GET /api/tickets/:id: ticket, conversation, activity, SLA clocks and the actions the caller may take. */
export const getTicket: Controller = async (ctx) => {
  const user = userOf(ctx);
  try {
    const detail = await getTicketDetail(user, Number(ctx.params.id));
    const now = clockNow();
    const t = detail.ticket;
    return Response.json({
      ...detail,
      sla: { response: responseClock(t, now), resolution: resolutionClock(t, now) },
      actions: [...availableActions(user, t, await getCatalog())],
    });
  } catch (e) {
    // Forbidden and missing look the same, so ticket ids can't be probed.
    if (e instanceof DomainError && e.code === "FORBIDDEN") throw new DomainError("NOT_FOUND", "Ticket not found.");
    throw e;
  }
};

const DONE: Record<TicketActionBody["action"], string> = {
  pick_up: "You picked up this ticket.",
  start: "Marked as in progress.",
  close: "Thanks for confirming. The ticket is closed.",
  assign: "Ticket assigned.",
  request_info: "Information requested; the SLA clock is paused.",
  resolve: "Ticket resolved.",
  comment: "Message posted.",
  reopen: "Ticket reopened with a fresh resolution window.",
  cancel: "Request cancelled.",
  priority: "Priority updated and SLA due dates recalculated.",
};

/**
 * PATCH /api/tickets/:id { action, version, ...fields }: every change to a ticket.
 * The service re-checks permission, version and status transition inside one transaction.
 */
export const updateTicket: Controller = async (ctx) => {
  const userId = userOf(ctx).id;
  const id = Number(ctx.params.id);
  const a = ctx.body as TicketActionBody;
  const outcome = await (() => {
    switch (a.action) {
      case "pick_up": return ticketService.pickUpTicket(userId, id, a.version);
      case "start": return ticketService.startTicket(userId, id, a.version);
      case "close": return ticketService.closeTicket(userId, id, a.version);
      case "assign": return ticketService.assignTicket(userId, id, a.version, a.assigneeId);
      case "request_info": return ticketService.requestInfoOnTicket(userId, id, a.version, a.body);
      case "resolve": return ticketService.resolveTicket(userId, id, a.version, a.body);
      case "comment": return ticketService.commentOnTicket(userId, id, a.version, a.body, !!a.internal);
      case "reopen": return ticketService.reopenTicket(userId, id, a.version, a.body);
      case "cancel": return ticketService.cancelTicket(userId, id, a.version, a.body);
      case "priority": return ticketService.changeTicketPriority(userId, id, a.version, a.priority, a.body);
    }
  })();
  const t = outcome.ticket;
  return Response.json({
    message: DONE[a.action],
    ticket: { id: t.id, version: t.version, status: t.status, priority: t.priority, assigneeId: t.assigneeId },
  });
};
