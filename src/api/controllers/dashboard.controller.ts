import { now as clockNow } from "@/lib/clock";
import { dashboardReport } from "@/lib/services/reports";
import { maybeRunSweep } from "@/lib/services/sweep";
import type { Controller } from "../core/router";

/** GET /api/dashboard: KPIs, breakdowns, 14-day trend and staff workload. */
export const getDashboard: Controller = async () => {
  await maybeRunSweep();
  return Response.json(await dashboardReport(clockNow()));
};
