import type { User } from "@/lib/domain/types";
import { currentUser } from "@/lib/session";
import { HttpError } from "../core/errors";
import type { Context, Middleware } from "../core/router";

/** Reads the signed session cookie and loads the user fresh from the DB (role/active never trusted from the cookie). */
export const authenticate: Middleware = async (ctx, next) => {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in again.");
  ctx.user = user;
  return next();
};

/** The user set by `authenticate`; controllers behind it can rely on this. */
export function userOf(ctx: Context): User {
  if (!ctx.user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in again.");
  return ctx.user;
}
