"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { now } from "@/lib/clock";
import { DomainError, friendlyMessage } from "@/lib/domain/errors";
import { daysUntil } from "@/lib/domain/priority";
import { CATEGORIES, PRIORITIES } from "@/lib/domain/types";
import { clearSession, requireUser, setSession } from "@/lib/session";
import { deactivateStaff, reactivateStaff } from "@/lib/services/staff";
import * as svc from "@/lib/services/tickets";
import { loadUser } from "@/lib/services/repo";
import { sql } from "@/lib/db";

export type FormState = { error?: string; ok?: string; duplicateOf?: { id: number; subject: string }; fields?: Record<string, string> } | null;

function fail(err: unknown): FormState {
  if (!(err instanceof DomainError)) console.error(err);
  return { error: friendlyMessage(err) };
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form.";

export async function loginAs(formData: FormData) {
  const id = Number(formData.get("userId"));
  const user = Number.isInteger(id) ? await loadUser(sql, id) : null;
  if (!user) redirect("/login?error=unknown");
  await setSession(user.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

const createSchema = z.object({
  category: z.enum(CATEGORIES, { message: "Choose a category." }),
  subject: z.string().trim().min(5, "Subject needs at least 5 characters.").max(120, "Keep the subject under 120 characters."),
  description: z.string().trim().min(10, "Describe the issue in at least 10 characters.").max(2000, "Keep the description under 2000 characters."),
  neededBy: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  createAnyway: z.literal("1").optional(),
});

export async function createTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries(["category", "subject", "description", "neededBy"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = createSchema.safeParse({ ...fields, createAnyway: formData.get("createAnyway") ?? undefined });
  if (!parsed.success) return { error: firstIssue(parsed.error), fields };
  const { neededBy, createAnyway, ...rest } = parsed.data;
  if (neededBy) {
    const d = daysUntil(neededBy, now());
    if (d < 0) return { error: "'Needed by' can't be in the past.", fields };
    if (d > 365) return { error: "'Needed by' must be within a year.", fields };
  }
  let id: number;
  try {
    const res = await svc.createTicketFor(user.id, { ...rest, neededBy: neededBy ?? null }, { createAnyway: !!createAnyway });
    if (!res.ok) return { duplicateOf: res.duplicateOf, fields };
    id = res.id;
  } catch (e) {
    return { ...fail(e), fields };
  }
  revalidatePath("/", "layout");
  redirect(`/tickets/${id}?created=1`);
}

const base = z.object({ ticketId: z.coerce.number().int().positive(), version: z.coerce.number().int().positive() });
const text = (msg: string) => z.string().trim().min(1, msg).max(4000, "That message is too long.");

const actionSchema = z.discriminatedUnion("intent", [
  base.extend({ intent: z.literal("pick_up") }),
  base.extend({ intent: z.literal("start") }),
  base.extend({ intent: z.literal("close") }),
  base.extend({ intent: z.literal("assign"), assigneeId: z.coerce.number({ message: "Choose a staff member." }).int().positive("Choose a staff member.") }),
  base.extend({ intent: z.literal("request_info"), body: text("Tell the student what you need.") }),
  base.extend({ intent: z.literal("resolve"), body: text("A resolution note is required.") }),
  base.extend({ intent: z.literal("comment"), body: text("Write a message first."), internal: z.literal("1").optional() }),
  base.extend({ intent: z.literal("reopen"), body: text("Tell us why the issue isn't fixed.") }),
  base.extend({ intent: z.literal("cancel"), body: z.string().trim().max(500).default("") }),
  base.extend({ intent: z.literal("priority"), priority: z.enum(PRIORITIES), body: text("Give a reason for changing the priority.") }),
]);

const DONE: Record<string, string> = {
  pick_up: "You picked up this ticket.",
  start: "Marked as in progress.",
  close: "Thanks for confirming. The ticket is closed.",
  assign: "Ticket assigned.",
  request_info: "Information requested; the SLA clock is paused.",
  resolve: "Ticket resolved.",
  comment: "Message posted.",
  reopen: "Ticket reopened with a fresh resolution window.",
  cancel: "Request cancelled.",
  priority: "Priority updated and SLA due dates recalculated.",
};

/** Single entry point for every ticket action; the service re-checks permission, version and transition. */
export async function ticketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = actionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const a = parsed.data;
  try {
    switch (a.intent) {
      case "pick_up": await svc.pickUpTicket(user.id, a.ticketId, a.version); break;
      case "start": await svc.startTicket(user.id, a.ticketId, a.version); break;
      case "close": await svc.closeTicket(user.id, a.ticketId, a.version); break;
      case "assign": await svc.assignTicket(user.id, a.ticketId, a.version, a.assigneeId); break;
      case "request_info": await svc.requestInfoOnTicket(user.id, a.ticketId, a.version, a.body); break;
      case "resolve": await svc.resolveTicket(user.id, a.ticketId, a.version, a.body); break;
      case "comment": await svc.commentOnTicket(user.id, a.ticketId, a.version, a.body, a.internal === "1"); break;
      case "reopen": await svc.reopenTicket(user.id, a.ticketId, a.version, a.body); break;
      case "cancel": await svc.cancelTicket(user.id, a.ticketId, a.version, a.body); break;
      case "priority": await svc.changeTicketPriority(user.id, a.ticketId, a.version, a.priority, a.body); break;
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: DONE[a.intent] };
}

export async function quickPickUp(formData: FormData) {
  const user = await requireUser();
  const parsed = base.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  try {
    await svc.pickUpTicket(user.id, parsed.data.ticketId, parsed.data.version);
  } catch (e) {
    redirect(`/?error=${encodeURIComponent(friendlyMessage(e))}`);
  }
  revalidatePath("/", "layout");
}

export async function staffStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const staffId = Number(formData.get("staffId"));
  const activate = formData.get("activate") === "1";
  try {
    if (activate) {
      await reactivateStaff(user.id, staffId);
      revalidatePath("/", "layout");
      return { ok: "Staff member reactivated. New tickets can be routed to them again." };
    }
    const r = await deactivateStaff(user.id, staffId);
    revalidatePath("/", "layout");
    return { ok: `Deactivated. ${r.moved} ticket(s) reassigned, ${r.queued} left in the queue.` };
  } catch (e) {
    return fail(e);
  }
}

export async function markAllReadAction() {
  const user = await requireUser();
  await svc.markNotificationsRead(user.id);
  revalidatePath("/", "layout");
}
