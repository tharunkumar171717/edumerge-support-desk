"use client";

import { CheckCircle2, Hand, Play, RotateCcw, XCircle } from "lucide-react";
import type { TicketAction } from "@/lib/domain/permissions";
import type { Priority } from "@/lib/domain/types";
import { ActionForm, Submit } from "./action-form";

function Disclosure({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <details className="group rounded-md border border-slate-200">
      <summary className={`cursor-pointer select-none list-none px-3 py-2 text-sm font-medium ${tone === "danger" ? "text-red-700" : "text-slate-700"} hover:bg-slate-50`}>
        <span className="mr-1 inline-block transition group-open:rotate-90">›</span> {title}
      </summary>
      <div className="border-t border-slate-200 p-3">{children}</div>
    </details>
  );
}

export function ActionPanel({
  ticketId,
  version,
  actions,
  priority,
  priorities,
  staff,
  assigneeId,
}: {
  ticketId: number;
  version: number;
  actions: TicketAction[];
  priority: Priority;
  priorities: { code: Priority; label: string }[]; // from master data, least urgent first
  staff: { id: number; name: string; teamLabel: string }[];
  assigneeId: number | null;
}) {
  const has = (a: TicketAction) => actions.includes(a);
  const f = { ticketId, version };
  const primary = has("pick_up") || has("start") || has("close");
  if (!actions.some((a) => !["comment_public", "comment_internal", "reply"].includes(a))) {
    return <p className="text-sm text-slate-500">No actions available to you on this ticket right now.</p>;
  }
  return (
    <div className="space-y-2">
      {primary && (
        <div className="flex flex-wrap gap-2">
          {has("pick_up") && (
            <ActionForm {...f} intent="pick_up"><Submit><Hand className="h-4 w-4" /> Pick up</Submit></ActionForm>
          )}
          {has("start") && (
            <ActionForm {...f} intent="start"><Submit><Play className="h-4 w-4" /> Start work</Submit></ActionForm>
          )}
          {has("close") && (
            <ActionForm {...f} intent="close"><Submit><CheckCircle2 className="h-4 w-4" /> Yes, it&apos;s fixed. Close it</Submit></ActionForm>
          )}
        </div>
      )}
      {has("resolve") && (
        <Disclosure title="Resolve">
          <ActionForm {...f} intent="resolve">
            <textarea name="body" required rows={3} className="input" placeholder="What was done? The student sees this note." />
            <Submit>Mark resolved</Submit>
          </ActionForm>
        </Disclosure>
      )}
      {has("request_info") && (
        <Disclosure title="Request info from student">
          <ActionForm {...f} intent="request_info">
            <textarea name="body" required rows={3} className="input" placeholder="What do you need from the student?" />
            <p className="text-xs text-slate-500">Pauses the resolution SLA until the student replies.</p>
            <Submit>Send and pause SLA</Submit>
          </ActionForm>
        </Disclosure>
      )}
      {has("assign") && (
        <Disclosure title={assigneeId ? "Reassign" : "Assign"}>
          <ActionForm {...f} intent="assign">
            <select name="assigneeId" required className="input" defaultValue="">
              <option value="" disabled>Choose active staff</option>
              {staff.filter((s) => s.id !== assigneeId).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.teamLabel}</option>)}
            </select>
            <Submit>Assign</Submit>
          </ActionForm>
        </Disclosure>
      )}
      {has("change_priority") && (
        <Disclosure title="Change priority">
          <ActionForm {...f} intent="priority">
            <select name="priority" className="input" defaultValue={priority}>
              {priorities.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
            <input name="body" required className="input" placeholder="Reason (required, shown in the timeline)" />
            <p className="text-xs text-slate-500">Both SLA due dates are recalculated from their start times.</p>
            <Submit>Update priority</Submit>
          </ActionForm>
        </Disclosure>
      )}
      {has("reopen") && (
        <Disclosure title="Not fixed? Reopen">
          <ActionForm {...f} intent="reopen">
            <textarea name="body" required rows={3} className="input" placeholder="What's still wrong?" />
            <Submit className="btn-secondary"><RotateCcw className="h-4 w-4" /> Reopen</Submit>
          </ActionForm>
        </Disclosure>
      )}
      {has("cancel") && (
        <Disclosure title="Cancel this request" tone="danger">
          <ActionForm {...f} intent="cancel">
            <input name="body" className="input" placeholder="Reason (optional)" />
            <Submit className="btn-danger"><XCircle className="h-4 w-4" /> Cancel request</Submit>
          </ActionForm>
        </Disclosure>
      )}
    </div>
  );
}

export function Composer({ ticketId, version, actions }: { ticketId: number; version: number; actions: TicketAction[] }) {
  const reply = actions.includes("reply");
  const canPublic = reply || actions.includes("comment_public");
  const canInternal = actions.includes("comment_internal");
  if (!canPublic && !canInternal) return null;
  return (
    <ActionForm ticketId={ticketId} version={version} intent="comment" className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <label htmlFor="composer" className="sr-only">Message</label>
      <textarea id="composer" name="body" required rows={3} className="input" placeholder={reply ? "Reply with the information staff asked for…" : "Write a message…"} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canInternal ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="internal" value="1" className="h-4 w-4 rounded border-slate-300" />
            Internal note <span className="text-xs text-slate-500">(never shown to the student)</span>
          </label>
        ) : (
          <span className="text-xs text-slate-500">{reply ? "Replying resumes the SLA clock." : ""}</span>
        )}
        <Submit>{reply ? "Send reply" : "Post"}</Submit>
      </div>
    </ActionForm>
  );
}
