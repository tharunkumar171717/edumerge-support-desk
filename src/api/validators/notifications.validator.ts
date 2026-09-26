import { z } from "zod";

export const markReadSchema = z.object({ ticketId: z.coerce.number().int().positive().optional() });
export type MarkReadBody = z.output<typeof markReadSchema>;
