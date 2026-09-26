import { apiUser, handler, parseId, readBody } from "@/lib/api/http";
import { runTicketAction, ticketActionSchema } from "@/lib/api/tickets";
import { now as clockNow } from "@/lib/clock";
import { DomainError } from "@/lib/domain/errors";
import { availableActions } from "@/lib/domain/permissions";
import { resolutionClock, responseClock } from "@/lib/domain/sla";
import { getCatalog } from "@/lib/services/catalog";
import { getTicketDetail } from "@/lib/services/queries";

type Ctx = RouteContext<"/api/tickets/[id]">;

/** GET /api/tickets/:id: ticket, conversation, activity, SLA clocks and the actions the caller may take. */
export const GET = handler(async (_req, ctx: Ctx) => {
  const user = await apiUser();
  const id = parseId((await ctx.params).id);
  try {
    const detail = await getTicketDetail(user, id);
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
});

/**
 * PATCH /api/tickets/:id  { action, version, ...fields }
 * Every change to a ticket: pick_up, start, assign, request_info, resolve, comment, reopen, cancel, close, priority.
 * `version` is the one the client last saw; a newer version on the server returns 409 STALE_VERSION.
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const user = await apiUser();
  const id = parseId((await ctx.params).id);
  const body = await readBody(req, ticketActionSchema);
  return Response.json(await runTicketAction(user.id, id, body));
});

// Clients that can only POST (HTML forms, some tools) use the same handler.
export const POST = PATCH;
