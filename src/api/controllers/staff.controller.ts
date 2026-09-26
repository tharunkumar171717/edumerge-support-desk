import { listActiveStaff, listAllStaff } from "@/lib/services/queries";
import { deactivateStaff, reactivateStaff } from "@/lib/services/staff";
import type { Controller } from "../core/router";
import { userOf } from "../middlewares/auth.middleware";
import type { StaffStatusBody } from "../validators/staff.validator";

/** GET /api/staff: every staff member by name; `?active=true` for assignable staff with their team, grouped by team. */
export const listStaff: Controller = async (ctx) => {
  const activeOnly = ctx.query.get("active") === "true";
  return Response.json({ staff: activeOnly ? await listActiveStaff() : await listAllStaff() });
};

/** PATCH /api/staff/:id { active }: deactivating re-homes the person's open tickets in the same transaction. */
export const setStaffStatus: Controller = async (ctx) => {
  const managerId = userOf(ctx).id;
  const staffId = Number(ctx.params.id);
  const { active } = ctx.body as StaffStatusBody;
  if (active) {
    await reactivateStaff(managerId, staffId);
    return Response.json({ active: true, message: "Staff member reactivated. New tickets can be routed to them again." });
  }
  const r = await deactivateStaff(managerId, staffId);
  return Response.json({ active: false, ...r, message: `Deactivated. ${r.moved} ticket(s) reassigned, ${r.queued} left in the queue.` });
};
