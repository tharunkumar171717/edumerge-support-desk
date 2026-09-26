import { Bell, LifeBuoy } from "lucide-react";
import Link from "next/link";
import type { User } from "@/lib/domain/types";
import { NavLinks } from "./nav-links";
import { LogoutButton } from "./session-buttons";

const LINKS: Record<User["role"], { href: string; label: string }[]> = {
  STUDENT: [
    { href: "/", label: "My requests" },
    { href: "/tickets", label: "History" },
    { href: "/tickets/new", label: "Raise a request" },
  ],
  STAFF: [
    { href: "/", label: "My work" },
    { href: "/tickets", label: "Tickets" },
  ],
  MANAGER: [
    { href: "/", label: "My work" },
    { href: "/tickets", label: "Tickets" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/team", label: "Team" },
  ],
};

export function Nav({ user, unread, teamLabel }: { user: User; unread: number; teamLabel: string }) {
  const sub = user.role === "STAFF" ? teamLabel : user.role === "STUDENT" ? user.rollNo : "Dean of Student Affairs";
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
          <LifeBuoy className="h-5 w-5 text-indigo-600" aria-hidden />
          <span className="hidden sm:inline">Student Support Desk</span>
        </Link>
        <NavLinks links={LINKS[user.role]} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/notifications" className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications, ${unread} unread`}>
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500">{sub}</div>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2 md:hidden">
        <NavLinks links={LINKS[user.role]} mobile />
      </div>
    </header>
  );
}
