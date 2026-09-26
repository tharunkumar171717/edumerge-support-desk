import { z } from "zod";
import { apiUser, handler, parseId, readBody } from "@/lib/api/http";
import { deactivateStaff, reactivateStaff } from "@/lib/services/staff";

// Booleans from JSON, or "true"/"false" from a form body.
const schema = z.object({
  active: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean({ message: "Say whether the staff member should be active (true or false)." })),
});

/**
 * PATCH /api/staff/:id  { active }  (managers only)
 * Deactivating re-homes the person's open tickets within their team in the same transaction.
 */
export const PATCH = handler(async (req, ctx: RouteContext<"/api/staff/[id]">) => {
  const user = await apiUser();
  const staffId = parseId((await ctx.params).id, "Staff member");
  const { active } = await readBody(req, schema);
  if (active) {
    await reactivateStaff(user.id, staffId);
    return Response.json({ active: true, message: "Staff member reactivated. New tickets can be routed to them again." });
  }
  const r = await deactivateStaff(user.id, staffId);
  return Response.json({ active: false, ...r, message: `Deactivated. ${r.moved} ticket(s) reassigned, ${r.queued} left in the queue.` });
});

export const POST = PATCH;
