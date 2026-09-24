"use client";

import { useActionState } from "react";
import { staffStatusAction, type FormState } from "@/app/actions";
import { Submit } from "@/components/action-form";

export function StaffToggle({ staffId, name, isActive, open }: { staffId: number; name: string; isActive: boolean; open: number }) {
  const [state, action] = useActionState<FormState, FormData>(staffStatusAction, null);
  return (
    <form
      action={action}
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        if (isActive && !confirm(`Deactivate ${name}? Their ${open} open ticket(s) will be reassigned.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="activate" value={isActive ? "0" : "1"} />
      <Submit className={isActive ? "btn-danger py-1 text-xs" : "btn-secondary py-1 text-xs"}>{isActive ? "Deactivate" : "Reactivate"}</Submit>
      {state?.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p role="status" className="max-w-56 text-right text-xs text-emerald-700">{state.ok}</p>}
    </form>
  );
}
