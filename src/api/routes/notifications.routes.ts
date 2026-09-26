import { getNotifications, getUnreadCount, markRead } from "../controllers/notifications.controller";
import { Router } from "../core/router";
import { authenticate } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { markReadSchema } from "../validators/notifications.validator";

export const notificationRoutes = new Router()
  .get("/", authenticate, getNotifications)
  .get("/unread", authenticate, getUnreadCount)
  .post("/read", authenticate, validateBody(markReadSchema), markRead);
