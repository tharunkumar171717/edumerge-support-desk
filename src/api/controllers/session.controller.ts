import { clearSession, setSession } from "@/lib/session";
import { loadUser } from "@/lib/services/repo";
import { HttpError } from "../core/errors";
import type { Controller } from "../core/router";
import type { LoginBody } from "../validators/session.validator";

/** POST /api/session: demo sign-in as a user; sets the signed, httpOnly session cookie. */
export const login: Controller = async (ctx) => {
  const { userId } = ctx.body as LoginBody;
  const user = await loadUser(userId);
  if (!user) throw new HttpError(404, "NOT_FOUND", "That user no longer exists. Pick another.");
  await setSession(user.id);
  return Response.json({ user });
};

/** DELETE /api/session: sign out. */
export const logout: Controller = async () => {
  await clearSession();
  return new Response(null, { status: 204 });
};
