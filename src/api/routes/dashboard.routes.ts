import { getDashboard } from "../controllers/dashboard.controller";
import { Router } from "../core/router";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

export const dashboardRoutes = new Router()
  .get("/", authenticate, requireRole("MANAGER"), getDashboard);
