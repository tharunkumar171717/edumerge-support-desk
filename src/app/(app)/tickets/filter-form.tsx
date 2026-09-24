"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/** Applies filters as soon as a dropdown changes, and keeps empty params out of the URL. */
export function FilterForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [pending, startTransition] = useTransition();

  function go(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${path}?${qs}` : path, { scroll: false }));
  }

  return (
    <form
      role="search"
      aria-busy={pending}
      className={`${className ?? ""} ${pending ? "opacity-60" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        // Text search waits for Enter; dropdowns apply immediately.
        if ((e.target as HTMLElement).tagName === "SELECT") go(e.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
