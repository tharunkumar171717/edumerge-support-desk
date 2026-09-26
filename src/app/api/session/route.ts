import { z } from "zod";
import { handler, HttpError, readBody } from "@/lib/api/http";
import { sql } from "@/lib/db";
import { clearSession, setSession } from "@/lib/session";
import { loadUser } from "@/lib/services/repo";

const loginSchema = z.object({ userId: z.coerce.number({ message: "Pick a user." }).int().positive("Pick a user.") });

/** POST /api/session: demo sign-in as a user, sets the signed session cookie. */
export const POST = handler(async (req) => {
  const { userId } = await readBody(req, loginSchema);
  const user = await loadUser(sql, userId);
  if (!user) throw new HttpError(404, "NOT_FOUND", "That user no longer exists. Pick another.");
  await setSession(user.id);
  return Response.json({ user });
});

/** DELETE /api/session: sign out. */
export const DELETE = handler(async () => {
  await clearSession();
  return new Response(null, { status: 204 });
});
