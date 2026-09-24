"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links, mobile = false }: { links: { href: string; label: string }[]; mobile?: boolean }) {
  const path = usePathname();
  const active = (href: string) => {
    if (href === "/") return path === "/";
    // "/tickets" owns ticket detail pages but not the "raise a request" form.
    if (href === "/tickets") return path === "/tickets" || /^\/tickets\/\d/.test(path);
    return path.startsWith(href);
  };
  return (
    <nav className={mobile ? "flex gap-1" : "hidden gap-1 md:flex"}>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${active(l.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
