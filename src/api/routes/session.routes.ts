import { getLoginUsers, getSession, login, logout } from "../controllers/session.controller";
import { Router } from "../core/router";
import { authenticate } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { loginSchema } from "../validators/session.validator";

export const sessionRoutes = new Router()
  .get("/", authenticate, getSession)
  .get("/users", getLoginUsers)
  .post("/", validateBody(loginSchema), login)
  .delete("/", logout);
