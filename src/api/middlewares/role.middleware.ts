import type { Role } from "@/lib/domain/types";
import { HttpError } from "../core/errors";
import type { Middleware } from "../core/router";
import { userOf } from "./auth.middleware";

/**
 * Coarse role gate for whole endpoints (use after `authenticate`). Finer rules, like "only the
 * ticket's owner can resolve it", live in the domain layer and are checked inside the services.
 */
export const requireRole = (...roles: Role[]): Middleware => async (ctx, next) => {
  if (!roles.includes(userOf(ctx).role)) {
    throw new HttpError(403, "FORBIDDEN", `Only ${roles.map((r) => r.toLowerCase()).join(" or ")}s can do that.`);
  }
  return next();
};
