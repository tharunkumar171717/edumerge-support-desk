import { runSlaSweep } from "@/lib/services/sweep";
import type { Controller } from "../core/router";

/** GET /api/cron/sla-sweep: escalations, reminders and auto-close. Idempotent. */
export const slaSweep: Controller = async () => Response.json({ ok: true, ...(await runSlaSweep()) });
