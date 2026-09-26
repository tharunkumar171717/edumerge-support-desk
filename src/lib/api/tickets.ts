import "server-only";
import { z } from "zod";
import { now } from "@/lib/clock";
import { invalid } from "@/lib/domain/errors";
import { daysUntil } from "@/lib/domain/priority";
import { PRIORITIES } from "@/lib/domain/types";
import * as svc from "@/lib/services/tickets";

// Forms post strings ("1"), API clients may post booleans; both mean the same thing.
const flag = z.union([z.boolean(), z.enum(["1", "0", "true", "false"]).transform((v) => v === "1" || v === "true")]);

export const createTicketSchema = z.object({
  // Category codes live in support_desk.categories; the service checks the code exists and is active.
  category: z.string({ message: "Choose a category." }).trim().min(1, "Choose a category."),
  subject: z.string().trim().min(5, "Subject needs at least 5 characters.").max(120, "Keep the subject under 120 characters."),
  description: z.string().trim().min(10, "Describe the issue in at least 10 characters.").max(2000, "Keep the description under 2000 characters."),
  neededBy: z.preprocess((v) => (v === "" ? null : v), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.").nullish()),
  createAnyway: flag.optional(),
});

export type CreateTicketBody = z.output<typeof createTicketSchema>;

export async function createTicket(userId: number, body: CreateTicketBody): Promise<svc.CreateResult> {
  const { neededBy, createAnyway, ...rest } = body;
  if (neededBy) {
    const d = daysUntil(neededBy, now());
    if (d < 0) throw invalid("'Needed by' can't be in the past.");
    if (d > 365) throw invalid("'Needed by' must be within a year.");
  }
  return svc.createTicketFor(userId, { ...rest, neededBy: neededBy ?? null }, { createAnyway: !!createAnyway });
}

const version = z.coerce.number({ message: "Missing ticket version." }).int().positive("Missing ticket version.");
const text = (msg: string) => z.string({ message: msg }).trim().min(1, msg).max(4000, "That message is too long.");

export const ticketActionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("pick_up"), version }),
    z.object({ action: z.literal("start"), version }),
    z.object({ action: z.literal("close"), version }),
    z.object({ action: z.literal("assign"), version, assigneeId: z.coerce.number({ message: "Choose a staff member." }).int().positive("Choose a staff member.") }),
    z.object({ action: z.literal("request_info"), version, body: text("Tell the student what you need.") }),
    z.object({ action: z.literal("resolve"), version, body: text("A resolution note is required.") }),
    z.object({ action: z.literal("comment"), version, body: text("Write a message first."), internal: flag.optional() }),
    z.object({ action: z.literal("reopen"), version, body: text("Tell us why the issue isn't fixed.") }),
    z.object({ action: z.literal("cancel"), version, body: z.string().trim().max(500).default("") }),
    z.object({ action: z.literal("priority"), version, priority: z.enum(PRIORITIES, { message: "Choose a valid priority." }), body: text("Give a reason for changing the priority.") }),
  ],
  { message: "Unknown ticket action." },
);

export type TicketActionBody = z.output<typeof ticketActionSchema>;

const DONE: Record<TicketActionBody["action"], string> = {
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

/** Runs one action; the service re-checks permission, version and transition inside a transaction. */
export async function runTicketAction(userId: number, id: number, a: TicketActionBody) {
  const o = await (() => {
    switch (a.action) {
      case "pick_up": return svc.pickUpTicket(userId, id, a.version);
      case "start": return svc.startTicket(userId, id, a.version);
      case "close": return svc.closeTicket(userId, id, a.version);
      case "assign": return svc.assignTicket(userId, id, a.version, a.assigneeId);
      case "request_info": return svc.requestInfoOnTicket(userId, id, a.version, a.body);
      case "resolve": return svc.resolveTicket(userId, id, a.version, a.body);
      case "comment": return svc.commentOnTicket(userId, id, a.version, a.body, !!a.internal);
      case "reopen": return svc.reopenTicket(userId, id, a.version, a.body);
      case "cancel": return svc.cancelTicket(userId, id, a.version, a.body);
      case "priority": return svc.changeTicketPriority(userId, id, a.version, a.priority, a.body);
    }
  })();
  const t = o.ticket;
  return {
    message: DONE[a.action],
    ticket: { id: t.id, version: t.version, status: t.status, priority: t.priority, assigneeId: t.assigneeId },
  };
}
