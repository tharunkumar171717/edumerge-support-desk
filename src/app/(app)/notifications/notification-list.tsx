"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { markSeen } from "@/components/mark-seen";
import { EmptyState } from "@/components/ticket-list";
import { ticketCode } from "@/lib/domain/config";
import { fmtDateTime } from "@/lib/format";

type Item = { id: number; ticketId: number | null; message: string; isRead: boolean; createdAt: Date; subject: string | null };

export function NotificationList({ items }: { items: Item[] }) {
  // Snapshot what was unread on arrival: marking them read refreshes the page, but they stay highlighted this visit.
  const [fresh] = useState(() => new Set(items.filter((n) => !n.isRead).map((n) => n.id)));
  const router = useRouter();

  useEffect(() => {
    if (fresh.size) markSeen().then((changed) => changed && router.refresh());
  }, [fresh, router]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-600">{fresh.size ? `${fresh.size} new since your last visit` : "No new notifications"}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="You're all caught up." hint="Updates on your tickets will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {items.map((n) => {
            const isNew = fresh.has(n.id);
            return (
              <li key={n.id} className={`flex gap-3 p-3 ${isNew ? "bg-indigo-50/50" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew ? "bg-indigo-600" : "bg-transparent"}`} aria-label={isNew ? "New" : undefined} />
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
