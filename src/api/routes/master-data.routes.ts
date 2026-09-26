import { getMasterData } from "../controllers/master-data.controller";
import { Router } from "../core/router";
import { authenticate } from "../middlewares/auth.middleware";

export const masterDataRoutes = new Router()
  .get("/", authenticate, getMasterData);
