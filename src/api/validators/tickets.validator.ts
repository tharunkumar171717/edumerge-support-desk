import { z } from "zod";
import { now } from "@/lib/clock";
import { daysUntil } from "@/lib/domain/priority";
import { PRIORITIES } from "@/lib/domain/types";
import { flag } from "./common.validator";

export const createTicketSchema = z.object({
  // Category codes live in support_desk.categories; the service checks the code exists and is active.
  category: z.string({ message: "Choose a category." }).trim().min(1, "Choose a category."),
  subject: z.string({ message: "Subject is required." }).trim().min(5, "Subject needs at least 5 characters.").max(120, "Keep the subject under 120 characters."),
  description: z.string({ message: "Description is required." }).trim().min(10, "Describe the issue in at least 10 characters.").max(2000, "Keep the description under 2000 characters."),
  neededBy: z.preprocess(
    (v) => (v === "" ? null : v),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
      .refine((d) => daysUntil(d, now()) >= 0, "'Needed by' can't be in the past.")
      .refine((d) => daysUntil(d, now()) <= 365, "'Needed by' must be within a year.")
      .nullish(),
  ),
  createAnyway: flag().optional(),
});
export type CreateTicketBody = z.output<typeof createTicketSchema>;

const version = z.coerce.number({ message: "Missing ticket version." }).int().positive("Missing ticket version.");
const text = (msg: string) => z.string({ message: msg }).trim().min(1, msg).max(4000, "That message is too long.");

/** Body of PATCH /api/tickets/:id: one action plus the ticket version the client last saw. */
export const ticketActionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("pick_up"), version }),
    z.object({ action: z.literal("start"), version }),
    z.object({ action: z.literal("close"), version }),
    z.object({ action: z.literal("assign"), version, assigneeId: z.coerce.number({ message: "Choose a staff member." }).int().positive("Choose a staff member.") }),
    z.object({ action: z.literal("request_info"), version, body: text("Tell the student what you need.") }),
    z.object({ action: z.literal("resolve"), version, body: text("A resolution note is required.") }),
    z.object({ action: z.literal("comment"), version, body: text("Write a message first."), internal: flag().optional() }),
    z.object({ action: z.literal("reopen"), version, body: text("Tell us why the issue isn't fixed.") }),
    z.object({ action: z.literal("cancel"), version, body: z.string().trim().max(500).default("") }),
    z.object({ action: z.literal("priority"), version, priority: z.enum(PRIORITIES, { message: "Choose a valid priority." }), body: text("Give a reason for changing the priority.") }),
  ],
  { message: "Unknown ticket action." },
);
export type TicketActionBody = z.output<typeof ticketActionSchema>;
