import { Search } from "lucide-react";
import Link from "next/link";
import { slaLabel } from "@/components/badges";
import { EmptyState, TicketList } from "@/components/ticket-list";
import { now as clockNow } from "@/lib/clock";
import { CATEGORY_CONFIG, OPEN_STATUSES, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/domain/config";
import { CATEGORIES, PRIORITIES, STATUSES, type SlaStateName } from "@/lib/domain/types";
import { requireUser } from "@/lib/session";
import { FilterForm } from "./filter-form";
import { applyFilters, listAllStaff, listVisibleTickets, type TicketFilters } from "@/lib/services/queries";

export const metadata = { title: "Tickets · Student Support Desk" };

const SLA_STATES: SlaStateName[] = ["breached", "at_risk", "on_track", "paused", "met", "missed"];
const SORTS = { newest: "Newest", oldest: "Oldest first", sla: "SLA urgency", priority: "Priority", updated: "Recently updated" } as const;

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters: TicketFilters = {
    q: typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined,
    status: pick(sp.status, [...STATUSES, "OPEN"] as const),
    category: pick(sp.category, CATEGORIES),
    priority: pick(sp.priority, PRIORITIES),
    assignee: typeof sp.assignee === "string" && /^(none|\d+)$/.test(sp.assignee) ? sp.assignee : undefined,
    sla: pick(sp.sla, SLA_STATES),
    sort: pick(sp.sort, Object.keys(SORTS) as (keyof typeof SORTS)[]),
  };
  const now = clockNow();
  const [all, staff] = await Promise.all([listVisibleTickets(user), user.role === "STUDENT" ? [] : listAllStaff()]);
  const rows = applyFilters(all, filters, now);
  const filtered = Object.values(filters).some(Boolean);
  const isStudent = user.role === "STUDENT";

  // Tab counts respect every other filter, so they always add up to what you'd see.
  const base = applyFilters(all, { ...filters, status: undefined }, now);
  const countOf = (s?: string) => (s === "OPEN" ? base.filter((t) => OPEN_STATUSES.includes(t.status)).length : s ? base.filter((t) => t.status === s).length : base.length);
  const tabs: [string | undefined, string][] = [["OPEN", "All open"], ...STATUSES.map((s) => [s, STATUS_LABELS[s]] as [string, string]), [undefined, "Everything"]];
  const tabHref = (status?: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && k !== "status") p.set(k, String(v));
    if (status) p.set("status", status);
    const qs = p.toString();
    return qs ? `/tickets?${qs}` : "/tickets";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{isStudent ? "My requests" : "Tickets"}</h1>
          <p className="text-sm text-slate-600">
            {isStudent ? "Everything you've raised." : user.role === "STAFF" ? "Your team's tickets and anything assigned to you." : "All tickets across teams."}
          </p>
        </div>
        {isStudent && <Link href="/tickets/new" className="btn-primary">Raise a request</Link>}
      </div>

      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1.5">
          {tabs.map(([s, label]) => {
            const active = filters.status === s;
            return (
              <li key={label}>
                <Link
                  href={tabHref(s)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{countOf(s)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Keyed on the filters so dropdowns re-sync after tab clicks and back/forward navigation. */}
      <FilterForm key={JSON.stringify(filters)} className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-8">
        <label className="relative col-span-2 lg:col-span-2">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input name="q" defaultValue={filters.q} placeholder="Code, subject, student, roll no" className="input pl-8" />
        </label>
        <Select name="status" label="Status" value={filters.status} options={[["OPEN", "All open"], ...STATUSES.map((s) => [s, STATUS_LABELS[s]] as [string, string])]} />
        <Select name="category" label="Category" value={filters.category} options={CATEGORIES.map((c) => [c, CATEGORY_CONFIG[c].label])} />
        <Select name="priority" label="Priority" value={filters.priority} options={PRIORITIES.map((p) => [p, PRIORITY_LABELS[p]])} />
        {!isStudent && <Select name="assignee" label="Assignee" value={filters.assignee} options={[["none", "Unassigned"], ...staff.map((s) => [String(s.id), s.name] as [string, string])]} />}
        <Select name="sla" label="SLA" value={filters.sla} options={SLA_STATES.map((s) => [s, slaLabel(s)])} />
        <Select name="sort" label="Sort" value={filters.sort} options={Object.entries(SORTS)} placeholder="Newest" />
        <div className="col-span-2 flex gap-2 sm:col-span-4 lg:col-span-8">
          <button className="btn-primary">Search</button>
          {filtered && <Link href="/tickets" className="btn-secondary">Clear all</Link>}
          <span className="ml-auto self-center text-sm text-slate-500">{rows.length} of {all.length}</span>
        </div>
      </FilterForm>

      {rows.length ? (
        <TicketList rows={rows} now={now} showStudent={!isStudent} studentView={isStudent} />
      ) : all.length ? (
        <EmptyState title="No tickets match these filters." hint="Try clearing a filter." />
      ) : (
        <EmptyState title="No tickets yet." hint={isStudent ? "Raise your first request and track it here." : "New requests from your team's categories will appear here."} />
      )}
    </div>
  );
}

function Select({ name, label, value, options, placeholder }: { name: string; label: string; value?: string; options: [string, string][]; placeholder?: string }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input" aria-label={label}>
        <option value="">{placeholder ?? `Any ${label.toLowerCase()}`}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
