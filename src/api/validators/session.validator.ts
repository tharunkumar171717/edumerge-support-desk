import { z } from "zod";

export const loginSchema = z.object({ userId: z.coerce.number({ message: "Pick a user." }).int().positive("Pick a user.") });
export type LoginBody = z.output<typeof loginSchema>;
