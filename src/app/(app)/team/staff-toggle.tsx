"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PendingProvider, Submit, type Feedback } from "@/components/action-form";
import { api } from "@/lib/api-client";

export function StaffToggle({ staffId, name, isActive, open }: { staffId: number; name: string; isActive: boolean; open: number }) {
  const router = useRouter();
  const [state, setState] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (isActive && !confirm(`Deactivate ${name}? Their ${open} open ticket(s) will be reassigned.`)) return;
        startTransition(async () => {
          const res = await api<{ message: string }>(`/api/staff/${staffId}`, { method: "PATCH", body: { active: !isActive } });
          setState(res.ok ? { ok: res.data.message } : { error: res.message });
          if (res.ok) router.refresh();
        });
      }}
    >
      <PendingProvider value={pending}>
        <Submit className={isActive ? "btn-danger py-1 text-xs" : "btn-secondary py-1 text-xs"}>{isActive ? "Deactivate" : "Reactivate"}</Submit>
      </PendingProvider>
      {state?.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p role="status" className="max-w-56 text-right text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
