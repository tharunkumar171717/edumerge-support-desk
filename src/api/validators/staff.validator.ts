import { z } from "zod";
import { flag } from "./common.validator";

export const staffStatusSchema = z.object({ active: flag("Say whether the staff member should be active (true or false).") });
export type StaffStatusBody = z.output<typeof staffStatusSchema>;
