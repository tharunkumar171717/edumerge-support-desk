import { apiUser, handler } from "@/lib/api/http";
import { listNotifications, unreadCount } from "@/lib/services/queries";

/** GET /api/notifications: the caller's latest 100 notifications and unread count. */
export const GET = handler(async () => {
  const user = await apiUser();
  const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return Response.json({ unread, items });
});
