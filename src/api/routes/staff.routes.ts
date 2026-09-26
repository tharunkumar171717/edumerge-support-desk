import { listStaff, setStaffStatus } from "../controllers/staff.controller";
import { Router } from "../core/router";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validateBody, validateParams } from "../middlewares/validate.middleware";
import { idParams } from "../validators/common.validator";
import { staffStatusSchema } from "../validators/staff.validator";

const guard = [authenticate, requireRole("MANAGER"), validateParams(idParams, "Staff member"), validateBody(staffStatusSchema)] as const;

export const staffRoutes = new Router()
  .get("/", authenticate, requireRole("STAFF", "MANAGER"), listStaff)
  .patch("/:id", ...guard, setStaffStatus)
  .post("/:id", ...guard, setStaffStatus);
