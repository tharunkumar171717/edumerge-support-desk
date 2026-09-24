import { requireUser } from "@/lib/session";
import { listNotifications } from "@/lib/services/queries";
import { NotificationList } from "./notification-list";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <NotificationList items={items.map((n) => ({ ...n }))} />
    </div>
  );
}
