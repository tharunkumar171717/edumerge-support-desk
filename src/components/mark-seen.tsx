"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api-client";

/** Marks notifications read once the page has been shown, then refreshes the bell if anything changed. */
export function MarkSeen({ ticketId }: { ticketId?: number }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markSeen(ticketId).then((changed) => changed && router.refresh());
  }, [ticketId, router]);
  return null;
}

export async function markSeen(ticketId?: number): Promise<boolean> {
  const res = await api<{ changed: number }>("/api/notifications/read", { method: "POST", body: ticketId ? { ticketId } : {} });
  return res.ok && res.data.changed > 0;
}
