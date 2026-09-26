"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import { api, formJson } from "@/lib/api/client";

export type Feedback = { error?: string; ok?: string; stale?: boolean } | null;

// Feedback lives above the forms: a successful action often removes its own button
// (e.g. "Start work"), which would otherwise unmount the success message with it.
const FeedbackCtx = createContext<(s: Feedback) => void>(() => {});
const PendingCtx = createContext(false);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Feedback>(null);
  const router = useRouter();
  return (
    <FeedbackCtx.Provider value={setState}>
      <div aria-live="polite">
        {state?.error && (
          <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
            {state.stale && (
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

/** Submit button that spins while its surrounding ActionForm (or PendingProvider) is busy. */
export function Submit({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const pending = useContext(PendingCtx);
  return (
    <button className={className} disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export const PendingProvider = PendingCtx.Provider;

/**
 * One ticket action, sent as PATCH /api/tickets/:id. Carries the version it was rendered with
 * so concurrent edits are caught, then refreshes the server-rendered page on success.
 */
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = formJson(form);
        startTransition(async () => {
          const res = await api<{ message: string }>(`/api/tickets/${ticketId}`, {
            method: "PATCH",
            body: { ...fields, action: intent, version },
          });
          if (!res.ok) {
            report({ error: res.message, stale: res.code === "STALE_VERSION" });
            return;
          }
          report({ ok: res.data.message });
          form.reset();
          router.refresh();
        });
      }}
    >
      <PendingCtx.Provider value={pending}>{children}</PendingCtx.Provider>
    </form>
  );
}
