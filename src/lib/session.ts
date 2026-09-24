import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "@/lib/db";
import type { User } from "@/lib/domain/types";
import { loadUser } from "@/lib/services/repo";

const COOKIE = "sd_session";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(userId: number): string {
  const v = String(userId);
  return `${v}.${sign(v)}`;
}

export function decodeSession(token: string | undefined): number | null {
  if (!token) return null;
  const [v, mac] = token.split(".");
  if (!v || !mac) return null;
  const expected = Buffer.from(sign(v));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const id = Number(v);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function setSession(userId: number): Promise<void> {
  (await cookies()).set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, freshly loaded so role and active flag are never trusted from the cookie. */
export const currentUser = cache(async (): Promise<User | null> => {
  const id = decodeSession((await cookies()).get(COOKIE)?.value);
  return id ? loadUser(sql, id) : null;
});

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
