import { z } from "zod";
import { apiUser, handler, readBody } from "@/lib/api/http";
import { markNotificationsRead } from "@/lib/services/tickets";

const schema = z.object({ ticketId: z.coerce.number().int().positive().optional() });

/** POST /api/notifications/read  { ticketId? }: mark all, or one ticket's, notifications read. */
export const POST = handler(async (req) => {
  const user = await apiUser();
  const { ticketId } = await readBody(req, schema);
  return Response.json({ changed: await markNotificationsRead(user.id, ticketId) });
});
