import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KpiTiles } from "@/components/kpi-tiles";
import { PickUpButton } from "@/components/pick-up-button";
import { EmptyState, TicketList } from "@/components/ticket-list";
import { now as clockNow } from "@/lib/clock";
import { isOpen } from "@/lib/domain/config";
import { worstSlaState } from "@/lib/domain/sla";
import type { User } from "@/lib/domain/types";
import { apiGet, fetchCatalog, fetchCurrentUser, serverApi } from "@/lib/server-api";
import { slaUrgency, type TicketRow } from "@/lib/services/queries";
import type { DashboardReport } from "@/lib/services/reports";

export async function generateMetadata(): Promise<Metadata> {
  // Matches the nav label each role sees.
  const r = await serverApi<{ user: User }>("/api/session");
  return { title: r.ok && r.data.user.role === "STUDENT" ? "My requests" : "My work" };
}

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-baseline gap-2 text-base font-semibold text-slate-900">
        {title} <span className="rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-600">{count}</span>
      </h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

export default async function MyWorkPage({ searchParams }: PageProps<"/">) {
  const user = await fetchCurrentUser();
  const { tickets: rows } = await apiGet<{ tickets: TicketRow[] }>("/api/tickets");
  const now = clockNow();
  const { error } = await searchParams;
  return (
    <div className="space-y-8">
      {typeof error === "string" && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {user.role === "STUDENT" && <StudentWork rows={rows} now={now} user={user} />}
      {user.role === "STAFF" && <StaffWork rows={rows} now={now} user={user} teamLabel={(await fetchCatalog()).teamLabel(user.team)} />}
      {user.role === "MANAGER" && <ManagerWork rows={rows} now={now} />}
    </div>
  );
}

function StudentWork({ rows, now, user }: { rows: TicketRow[]; now: Date; user: User }) {
  const waiting = rows.filter((t) => t.status === "WAITING_ON_STUDENT");
  const resolved = rows.filter((t) => t.status === "RESOLVED");
  const open = rows.filter((t) => isOpen(t.status) && t.status !== "WAITING_ON_STUDENT");
  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Hi {user.name.split(" ")[0]}, how can we help?</h1>
          <p className="text-sm text-indigo-100">Fees, attendance, ID cards, documents, certificates: raise it here and track it to closure.</p>
        </div>
        <Link href="/tickets/new" className="btn bg-white px-5 py-3 text-base text-indigo-700 hover:bg-indigo-50">
          <Plus className="h-5 w-5" /> Raise a request
        </Link>
      </div>
      <Section title="Needs your reply" count={waiting.length} hint="Staff need more information. The clock is paused until you reply.">
        {waiting.length ? <TicketList rows={waiting} now={now} showStudent={false} studentView /> : <EmptyState title="Nothing needs your reply." />}
      </Section>
      <Section title="Awaiting your confirmation" count={resolved.length} hint="Confirm if it's fixed, or reopen with a reason. These close automatically after 3 days.">
        {resolved.length ? <TicketList rows={resolved} now={now} showStudent={false} studentView /> : <EmptyState title="No resolved requests waiting on you." />}
      </Section>
      <Section title="Open requests" count={open.length}>
        {open.length ? <TicketList rows={open} now={now} showStudent={false} studentView /> : <EmptyState title="You have no open requests." hint="Anything you raise will show up here." />}
      </Section>
    </>
  );
}

function StaffWork({ rows, now, user, teamLabel }: { rows: TicketRow[]; now: Date; user: User; teamLabel: string }) {
  const mine = rows.filter((t) => t.assigneeId === user.id && isOpen(t.status)).sort((a, b) => slaUrgency(a, now) - slaUrgency(b, now));
  const hot = mine.filter((t) => ["breached", "at_risk"].includes(worstSlaState(t, now)));
  const queue = rows
    .filter((t) => t.assigneeId === null && isOpen(t.status) && t.team === user.team)
    .sort((a, b) => slaUrgency(a, now) - slaUrgency(b, now));
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My work</h1>
        <p className="text-sm text-slate-600">{teamLabel} · {mine.length} open ticket(s) assigned to you</p>
      </div>
      <Section title="Overdue / at risk" count={hot.length} hint="Act on these first.">
        {hot.length ? <TicketList rows={hot} now={now} showAssignee={false} /> : <EmptyState title="Nothing overdue or at risk. Nice." />}
      </Section>
      <Section title="My open tickets" count={mine.length} hint="Sorted by SLA urgency: least time left first; paused tickets last.">
        {mine.length ? <TicketList rows={mine} now={now} showAssignee={false} /> : <EmptyState title="No open tickets assigned to you." hint="Pick one up from your team's queue below." />}
      </Section>
      <Section title="Unassigned in my team" count={queue.length}>
        {queue.length ? (
          user.isActive ? <TicketList rows={queue} now={now} showAssignee={false} action={(t) => <PickUpButton ticketId={t.id} version={t.version} />} /> : <TicketList rows={queue} now={now} showAssignee={false} />
        ) : (
          <EmptyState title="Your team's queue is empty." />
        )}
      </Section>
    </>
  );
}

async function ManagerWork({ rows, now }: { rows: TicketRow[]; now: Date }) {
  const report = await apiGet<DashboardReport>("/api/dashboard");
  const open = rows.filter((t) => isOpen(t.status)).sort((a, b) => slaUrgency(a, now) - slaUrgency(b, now));
  const breached = open.filter((t) => worstSlaState(t, now) === "breached");
  const escalated = open.filter((t) => t.escalationLevel > 0).sort((a, b) => b.escalationLevel - a.escalationLevel);
  const unassigned = open.filter((t) => t.assigneeId === null);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Today&apos;s attention list</h1>
          <p className="text-sm text-slate-600">What needs a manager right now. Full metrics are on the dashboard.</p>
        </div>
        <Link href="/dashboard" className="btn-secondary">Open dashboard</Link>
      </div>
      <KpiTiles kpis={report.kpis} />
      <Section title="Unassigned" count={unassigned.length} hint="No active staff in the team, or waiting in the queue. Assign from the ticket page.">
        {unassigned.length ? <TicketList rows={unassigned} now={now} /> : <EmptyState title="Every open ticket has an owner." />}
      </Section>
      <Section title="SLA breached" count={breached.length}>
        {breached.length ? <TicketList rows={breached} now={now} /> : <EmptyState title="No breached tickets." />}
      </Section>
      <Section title="Escalated" count={escalated.length} hint="L1 = first response missed · L2 = resolution overdue.">
        {escalated.length ? <TicketList rows={escalated} now={now} /> : <EmptyState title="No escalations." />}
      </Section>
    </>
  );
}
