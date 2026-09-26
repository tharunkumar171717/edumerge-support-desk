import { slaSweep } from "../controllers/cron.controller";
import { Router } from "../core/router";
import { requireCronSecret } from "../middlewares/cron.middleware";

export const cronRoutes = new Router()
  .get("/sla-sweep", requireCronSecret, slaSweep);
