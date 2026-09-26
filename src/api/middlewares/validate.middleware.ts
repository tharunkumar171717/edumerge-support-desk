import type { NextRequest } from "next/server";
import type { z } from "zod";
import { HttpError } from "../core/errors";
import type { Middleware } from "../core/router";

/** JSON (with or without a content type), form-data or urlencoded; an empty body is `{}`. */
async function readRaw(req: NextRequest): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    return Object.fromEntries([...form].filter(([, v]) => typeof v === "string"));
  }
  if (!type || type.includes("json") || type.startsWith("text/plain")) {
    const text = await req.text();
    try {
      return text.trim() ? JSON.parse(text) : {};
    } catch {
      throw new HttpError(400, "BAD_JSON", "The request body is not valid JSON.");
    }
  }
  throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the body as JSON, form-data or x-www-form-urlencoded.");
}

/** Parses the body against a zod schema into `ctx.body`; failures become 422 with the first message. */
export const validateBody = (schema: z.ZodType): Middleware => async (ctx, next) => {
  ctx.body = schema.parse(await readRaw(ctx.req));
  return next();
};

/** Validates path params (e.g. `:id`). A bad id is reported as not found, so ids can't be probed. */
export const validateParams = (schema: z.ZodType, what = "Resource"): Middleware => async (ctx, next) => {
  if (!schema.safeParse(ctx.params).success) throw new HttpError(404, "NOT_FOUND", `${what} not found.`);
  return next();
};
