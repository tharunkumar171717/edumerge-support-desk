"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "@/lib/api-client";

/** Demo sign-in: POST /api/session, then into the app. */
export function LoginButton({ userId, children }: { userId: number; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await api("/api/session", { method: "POST", body: { userId } });
            if (!res.ok) return setError(res.message);
            router.push("/");
            router.refresh();
          })
        }
        className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
      >
        {children}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

/** DELETE /api/session, back to the sign-in page. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await api("/api/session", { method: "DELETE" });
          router.push("/login");
          router.refresh();
        })
      }
      className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
      aria-label="Switch user"
      title="Switch user"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
