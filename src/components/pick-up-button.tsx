"use client";

import { Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { api } from "@/lib/api/client";

/** One-click pick up from the team queue; errors surface in the page's alert via ?error=. */
export function PickUpButton({ ticketId, version }: { ticketId: number; version: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-secondary py-1 text-xs"
      onClick={() =>
        startTransition(async () => {
          const res = await api(`/api/tickets/${ticketId}`, { method: "PATCH", body: { action: "pick_up", version } });
          if (res.ok) router.refresh();
          else router.replace(`/?error=${encodeURIComponent(res.message)}`);
        })
      }
    >
      <Hand className="h-3.5 w-3.5" /> Pick up
    </button>
  );
}
