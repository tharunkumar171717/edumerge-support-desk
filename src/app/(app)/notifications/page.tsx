import { apiGet } from "@/lib/server-api";
import type { listNotifications } from "@/lib/services/queries";
import { NotificationList } from "./notification-list";

export const metadata = { title: "Notifications" };

type Notifications = { unread: number; items: Awaited<ReturnType<typeof listNotifications>> };

export default async function NotificationsPage() {
  const { items } = await apiGet<Notifications>("/api/notifications");
  return (
    <div className="mx-auto max-w-3xl">
      <NotificationList items={items.map((n) => ({ ...n }))} />
    </div>
  );
}
