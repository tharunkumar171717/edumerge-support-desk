import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { FeedbackProvider } from "@/components/action-form";
import { ActionPanel, Composer } from "@/components/action-panel";
import { CategoryTag, EscalationFlag, PriorityBadge, StatusBadge } from "@/components/badges";
import { MarkSeen } from "@/components/mark-seen";
import { SlaPanel } from "@/components/sla-panel";
import { Timeline } from "@/components/timeline";
import { now as clockNow } from "@/lib/clock";
import { CATEGORY_CONFIG, TEAM_LABELS, ticketCode } from "@/lib/domain/config";
import { DomainError } from "@/lib/domain/errors";
import { availableActions } from "@/lib/domain/permissions";
import { fmtAge, fmtDate, fmtDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getTicketDetail, listActiveStaff } from "@/lib/services/queries";

// Shared by generateMetadata and the page so the ticket is loaded once per request.
const loadTicket = cache(async (rawId: string) => {
  const user = await requireUser();
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    return { user, detail: await getTicketDetail(user, id) };
  } catch (e) {
    // Forbidden and missing look the same, so ticket ids can't be probed.
    if (e instanceof DomainError) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: PageProps<"/tickets/[id]">): Promise<Metadata> {
  const loaded = await loadTicket((await params).id);
  if (!loaded) return { title: "Ticket not found" };
  const t = loaded.detail.ticket;
  return { title: `${ticketCode(t.id)} · ${t.subject}` };
}

export default async function TicketPage({ params, searchParams }: PageProps<"/tickets/[id]">) {
  const loaded = await loadTicket((await params).id);
  if (!loaded) notFound();
  const { user, detail } = loaded;
  const { ticket: t, comments, events } = detail;
  const now = clockNow();
  const actions = [...availableActions(user, t)];
  const staff = actions.includes("assign") ? await listActiveStaff() : [];
  const staffOptions = staff.map((s) => ({ ...s, team: TEAM_LABELS[s.team as keyof typeof TEAM_LABELS] }));
  const { created } = await searchParams;
  const isStudent = user.role === "STUDENT";

  return (
    <div className="space-y-4">
      <MarkSeen ticketId={t.id} />
      <Link href={isStudent ? "/" : "/tickets"} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      {created && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Request raised as {ticketCode(t.id)}. {t.assigneeName ? `${t.assigneeName} from ${TEAM_LABELS[CATEGORY_CONFIG[t.category].team]} will handle it.` : "It's in the queue and will be picked up soon."}
        </p>
      )}
      <header className="card">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
          {ticketCode(t.id)} · <CategoryTag category={t.category} /> {!isStudent && <EscalationFlag level={t.escalationLevel} />}
        </div>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{t.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          <span className="text-xs text-slate-500">Opened {fmtAge(t.createdAt, now)} ago</span>
        </div>
      </header>

      <FeedbackProvider>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{t.description}</p>
            {t.resolutionNote && (
              <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                <span className="font-medium">Resolution: </span>{t.resolutionNote}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
            {comments.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border p-3 text-sm ${c.isInternal ? "border-amber-300 border-dashed bg-amber-50" : c.authorRole === "STUDENT" ? "border-slate-200 bg-white" : "border-indigo-100 bg-indigo-50/60"}`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-800">{c.authorName}</span>
                    <span>{c.authorRole === "STUDENT" ? "Student" : "Staff"}</span>
                    {c.isInternal && <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 font-medium text-amber-900"><Lock className="h-3 w-3" /> Internal note</span>}
                    <span className="ml-auto">{fmtDateTime(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-800">{c.body}</p>
                </li>
              ))}
            </ul>
            <Composer ticketId={t.id} version={t.version} actions={actions} />
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Activity</h2>
            <Timeline events={events} />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Actions</h2>
            <ActionPanel ticketId={t.id} version={t.version} actions={actions} priority={t.priority} staff={staffOptions} assigneeId={t.assigneeId} />
          </section>
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">SLA</h2>
            <SlaPanel ticket={t} now={now} />
          </section>
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Student</dt><dd className="text-slate-900">{t.studentName} <span className="text-slate-500">{t.studentRollNo}</span></dd>
              <dt className="text-slate-500">Team</dt><dd className="text-slate-900">{TEAM_LABELS[CATEGORY_CONFIG[t.category].team]}</dd>
              <dt className="text-slate-500">Owner</dt><dd className="text-slate-900">{t.assigneeName ?? <span className="text-amber-700">Unassigned</span>}</dd>
              <dt className="text-slate-500">Raised</dt><dd className="text-slate-900">{fmtDateTime(t.createdAt)}</dd>
              {t.neededBy && (<><dt className="text-slate-500">Needed by</dt><dd className="text-slate-900">{fmtDate(t.neededBy)}</dd></>)}
              <dt className="text-slate-500">Updated</dt><dd className="text-slate-900">{fmtDateTime(t.updatedAt)}</dd>
              {t.closedAt && (<><dt className="text-slate-500">{t.status === "CANCELLED" ? "Cancelled" : "Closed"}</dt><dd className="text-slate-900">{fmtDateTime(t.closedAt)}</dd></>)}
            </dl>
          </section>
        </aside>
      </div>
      </FeedbackProvider>
    </div>
  );
}
