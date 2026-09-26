import { apiUser, handler, HttpError, readBody } from "@/lib/api/http";
import { createTicket, createTicketSchema } from "@/lib/api/tickets";
import { now as clockNow } from "@/lib/clock";
import { worstSlaState } from "@/lib/domain/sla";
import { applyFilters, listVisibleTickets, parseTicketFilters } from "@/lib/services/queries";

/**
 * GET /api/tickets?status=&category=&priority=&assignee=&sla=&sort=&q=
 * Tickets the caller may see, filtered and sorted like the Tickets page.
 */
export const GET = handler(async (req) => {
  const user = await apiUser();
  const filters = parseTicketFilters(Object.fromEntries(req.nextUrl.searchParams));
  const now = clockNow();
  const rows = applyFilters(await listVisibleTickets(user), filters, now);
  return Response.json({ tickets: rows.map((t) => ({ ...t, slaState: worstSlaState(t, now) })) });
});

/**
 * POST /api/tickets  { category, subject, description, neededBy?, createAnyway? }
 * 201 { id } · 409 DUPLICATE with `duplicateOf` when the student already has an open ticket in that category.
 */
export const POST = handler(async (req) => {
  const user = await apiUser();
  const body = await readBody(req, createTicketSchema);
  const res = await createTicket(user.id, body);
  if (!res.ok) {
    throw new HttpError(409, "DUPLICATE", "You already have an open request in this category.", { duplicateOf: res.duplicateOf });
  }
  return Response.json({ id: res.id }, { status: 201, headers: { Location: `/api/tickets/${res.id}` } });
});
