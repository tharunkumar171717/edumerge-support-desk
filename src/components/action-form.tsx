"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useState } from "react";
import { useFormStatus } from "react-dom";
import { ticketAction, type FormState } from "@/app/actions";

// Feedback lives above the forms: a successful action often removes its own button
// (e.g. "Start work"), which would otherwise unmount the success message with it.
const FeedbackCtx = createContext<(s: FormState) => void>(() => {});

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FormState>(null);
  const router = useRouter();
  const isStale = state?.error?.includes("updated by someone else");
  return (
    <FeedbackCtx.Provider value={setState}>
      <div aria-live="polite">
        {state?.error && (
          <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
            {isStale && (
              <button
                type="button"
                onClick={() => {
                  setState(null);
                  router.refresh();
                }}
                className="inline-flex items-center gap-1 font-medium underline"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reload
              </button>
            )}
          </p>
        )}
        {state?.ok && <p role="status" className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      </div>
      {children}
    </FeedbackCtx.Provider>
  );
}

export function Submit({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** One ticket action. Carries the version it was rendered with so concurrent edits are caught. */
export function ActionForm({
  ticketId,
  version,
  intent,
  children,
  className = "space-y-2",
}: {
  ticketId: number;
  version: number;
  intent: string;
  children: React.ReactNode;
  className?: string;
}) {
  const report = useContext(FeedbackCtx);
  const [, action] = useActionState<FormState, FormData>(async (prev, data) => {
    const result = await ticketAction(prev, data);
    report(result);
    return result;
  }, null);
  return (
    <form action={action} className={className}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="intent" value={intent} />
      {children}
    </form>
  );
}
