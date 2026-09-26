import { listNotifications, unreadCount } from "@/lib/services/queries";
import { markNotificationsRead } from "@/lib/services/tickets";
import type { Controller } from "../core/router";
import { userOf } from "../middlewares/auth.middleware";
import type { MarkReadBody } from "../validators/notifications.validator";

/** GET /api/notifications: the caller's latest 100 notifications and unread count. */
export const getNotifications: Controller = async (ctx) => {
  const user = userOf(ctx);
  const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return Response.json({ unread, items });
};

/** POST /api/notifications/read { ticketId? }: mark all, or one ticket's, notifications read. */
export const markRead: Controller = async (ctx) => {
  const { ticketId } = ctx.body as MarkReadBody;
  return Response.json({ changed: await markNotificationsRead(userOf(ctx).id, ticketId) });
};
