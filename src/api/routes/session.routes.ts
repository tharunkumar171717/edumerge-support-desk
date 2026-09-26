import { login, logout } from "../controllers/session.controller";
import { Router } from "../core/router";
import { validateBody } from "../middlewares/validate.middleware";
import { loginSchema } from "../validators/session.validator";

export const sessionRoutes = new Router()
  .post("/", validateBody(loginSchema), login)
  .delete("/", logout);
