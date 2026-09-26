import { z } from "zod";

/** `:id` path param: a positive integer. */
export const idParams = z.object({ id: z.string().regex(/^[1-9]\d*$/) });

/** A yes/no field: JSON clients post booleans, forms post "1"/"0" or "true"/"false". */
export const flag = (message = "Use true or false.") =>
  z.union([z.boolean(), z.enum(["1", "0", "true", "false"]).transform((v) => v === "1" || v === "true")], { message });
