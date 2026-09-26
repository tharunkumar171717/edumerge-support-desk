import { timingSafeEqual } from "node:crypto";
import { HttpError } from "../core/errors";
import type { Middleware } from "../core/router";

/** Vercel Cron calls with `Authorization: Bearer $CRON_SECRET`; compared in constant time. */
export const requireCronSecret: Middleware = async (ctx, next) => {
  const secret = process.env.CRON_SECRET;
  const given = ctx.req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) throw new HttpError(401, "UNAUTHORIZED", "Missing or wrong cron secret.");
  return next();
};
