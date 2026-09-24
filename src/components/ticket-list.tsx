import Link from "next/link";
import { ticketCode } from "@/lib/domain/config";
import { worstSlaState } from "@/lib/domain/sla";
import { fmtAge } from "@/lib/format";
import type { TicketRow } from "@/lib/services/queries";
import { CategoryTag, EscalationFlag, PriorityBadge, SlaChip, StatusBadge } from "./badges";

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** Table on desktop, stacked cards on phones. */
export function TicketList({
  rows,
  now,
  showStudent = true,
  showAssignee = true,
  studentView = false,
  action,
}: {
  rows: TicketRow[];
  now: Date;
  showStudent?: boolean;
  showAssignee?: boolean;
  studentView?: boolean; // escalation levels are internal
  action?: (t: TicketRow) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Ticket</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">SLA</th>
            <th className="px-3 py-2 font-medium">Age</th>
            {showAssignee && <th className="px-3 py-2 font-medium">Assignee</th>}
            {action && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="max-w-md px-3 py-2">
                <Link href={`/tickets/${t.id}`} className="group block">
                  <span className="flex items-center gap-2 font-mono text-xs text-slate-500">
                    {ticketCode(t.id)} · <CategoryTag category={t.category} /> {!studentView && <EscalationFlag level={t.escalationLevel} />}
                  </span>
                  <span className="block truncate font-medium text-slate-900 group-hover:text-indigo-700">{t.subject}</span>
                  {showStudent && <span className="block text-xs text-slate-500">{t.studentName} · {t.studentRollNo}</span>}
                </Link>
              </td>
              <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
              <td className="px-3 py-2"><PriorityBadge priority={t.priority} /></td>
              <td className="px-3 py-2"><SlaChip state={worstSlaState(t, now)} /></td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtAge(t.createdAt, now)}</td>
              {showAssignee && <td className="whitespace-nowrap px-3 py-2 text-slate-600">{t.assigneeName ?? <span className="text-amber-700">Unassigned</span>}</td>}
              {action && <td className="px-3 py-2 text-right">{action(t)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((t) => (
          <li key={t.id} className="p-3">
            <Link href={`/tickets/${t.id}`} className="block">
              <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                {ticketCode(t.id)} · <CategoryTag category={t.category} /> {!studentView && <EscalationFlag level={t.escalationLevel} />}
              </div>
              <div className="font-medium text-slate-900">{t.subject}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <SlaChip state={worstSlaState(t, now)} />
                <span className="text-xs text-slate-500">{fmtAge(t.createdAt, now)} old</span>
              </div>
              {(showStudent || showAssignee) && (
                <div className="mt-1 text-xs text-slate-500">
                  {showStudent && t.studentName}
                  {showStudent && showAssignee && " → "}
                  {showAssignee && (t.assigneeName ?? "Unassigned")}
                </div>
              )}
            </Link>
            {action && <div className="mt-2">{action(t)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
