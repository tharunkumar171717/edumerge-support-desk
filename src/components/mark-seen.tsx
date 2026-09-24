"use client";

import { useEffect, useRef } from "react";
import { markSeenAction } from "@/app/actions";

/** Marks notifications read once the page has been shown; the server action refreshes the bell. */
export function MarkSeen({ ticketId }: { ticketId?: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markSeenAction(ticketId).catch(() => {});
  }, [ticketId]);
  return null;
}
