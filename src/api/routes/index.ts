import { Router } from "../core/router";
import { cronRoutes } from "./cron.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { masterDataRoutes } from "./master-data.routes";
import { notificationRoutes } from "./notifications.routes";
import { sessionRoutes } from "./session.routes";
import { staffRoutes } from "./staff.routes";
import { ticketRoutes } from "./tickets.routes";

/** Every /api endpoint, mounted by resource. Request flow: route → middlewares → controller → service → DB. */
export const apiRouter = new Router()
  .use("/session", sessionRoutes)
  .use("/master-data", masterDataRoutes)
  .use("/tickets", ticketRoutes)
  .use("/notifications", notificationRoutes)
  .use("/staff", staffRoutes)
  .use("/dashboard", dashboardRoutes)
  .use("/cron", cronRoutes);
