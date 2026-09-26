import { apiUser, handler, HttpError } from "@/lib/api/http";
import { now as clockNow } from "@/lib/clock";
import { dashboardReport } from "@/lib/services/reports";

/** GET /api/dashboard: management KPIs, breakdowns, trend and staff workload (managers only). */
export const GET = handler(async () => {
  const user = await apiUser();
  if (user.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only managers can see the dashboard.");
  return Response.json(await dashboardReport(clockNow()));
});
