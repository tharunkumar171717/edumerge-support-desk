import Link from "next/link";
import { markAllReadAction } from "@/app/actions";
import { EmptyState } from "@/components/ticket-list";
import { ticketCode } from "@/lib/domain/config";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { listNotifications } from "@/lib/services/queries";

export const metadata = { title: "Notifications · Student Support Desk" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.isRead).length;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-600">{unread} unread</p>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <button className="btn-secondary">Mark all as read</button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState title="You're all caught up." hint="Updates on your tickets will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {items.map((n) => (
            <li key={n.id} className={`flex gap-3 p-3 ${n.isRead ? "" : "bg-indigo-50/50"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-indigo-600"}`} aria-label={n.isRead ? undefined : "Unread"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900">{n.message}</p>
                {n.ticketId && (
                  <Link href={`/tickets/${n.ticketId}`} className="block truncate text-sm text-indigo-700 hover:underline">
                    {ticketCode(n.ticketId)} · {n.subject}
                  </Link>
                )}
                <p className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
