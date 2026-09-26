import { clearSession, setSession } from "@/lib/session";
import { listUsersForLogin } from "@/lib/services/queries";
import { loadUser } from "@/lib/services/repo";
import { HttpError } from "../core/errors";
import type { Controller } from "../core/router";
import { userOf } from "../middlewares/auth.middleware";
import type { LoginBody } from "../validators/session.validator";

/** GET /api/session: the signed-in user. */
export const getSession: Controller = async (ctx) => Response.json({ user: userOf(ctx) });

/** GET /api/session/users: everyone who can be picked on the demo sign-in page. */
export const getLoginUsers: Controller = async () => Response.json({ users: await listUsersForLogin() });

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
