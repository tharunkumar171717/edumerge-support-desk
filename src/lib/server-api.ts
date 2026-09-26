import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ApiResult } from "@/lib/api-client";
import { Catalog, type MasterData } from "@/lib/domain/catalog";
import type { User } from "@/lib/domain/types";

// Server Components read data through the /api routes, like the browser does, so every read and
// write goes through the same middlewares (auth, roles, validation) and error mapping.

// JSON has no dates: timestamps come back as ISO strings and are turned back into Dates here.
// Date-only fields such as `neededBy` (YYYY-MM-DD) don't match and stay strings.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const reviveDates = (_key: string, v: unknown) => (typeof v === "string" && ISO_TIMESTAMP.test(v) ? new Date(v) : v);

/** Where this app is being served from; API_URL overrides it (e.g. when the public URL sits behind SSO). */
async function baseUrl(h: Headers): Promise<string> {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * GET an /api path as the signed-in user (their session cookie is forwarded). Never throws; callers
 * branch on `ok`. Cached per request, so a layout, page and generateMetadata asking for the same
 * path share one call.
 */
export const serverApi = cache(async <T,>(path: string): Promise<ApiResult<T>> => {
  const h = await headers();
  let res: Response;
  try {
    res = await fetch(`${await baseUrl(h)}${path}`, { headers: { cookie: h.get("cookie") ?? "", accept: "application/json" }, cache: "no-store" });
  } catch (e) {
    console.error(`GET ${path} failed`, e);
    return { ok: false, status: 0, code: "NETWORK", message: "Couldn't reach the server. Please try again.", body: null };
  }
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text, reviveDates) : null;
  } catch {
    // Not JSON: a proxy or platform error page rather than our API.
  }
  if (res.ok && json) return { ok: true, status: res.status, data: json as T };
  const error = (json?.error ?? {}) as { code?: string; message?: string };
  return { ok: false, status: res.status, code: error.code ?? "ERROR", message: error.message ?? "Something went wrong. Please try again.", body: json };
});

/**
 * GET an /api path for a page, turning failures into navigation: 401 → sign-in, 403 → home,
 * 404 → not-found page, anything else → the error boundary.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const r = await serverApi<T>(path);
  if (r.ok) return r.data;
  if (r.status === 401) redirect("/login");
  if (r.status === 403) redirect("/");
  if (r.status === 404) notFound();
  throw new Error(`GET ${path} failed (${r.status} ${r.code}): ${r.message}`);
}

/** GET /api/session: the signed-in user (redirects to sign-in when there is none). */
export async function fetchCurrentUser(): Promise<User> {
  return (await apiGet<{ user: User }>("/api/session")).user;
}

/** GET /api/master-data, wrapped in the same lookups the server uses. */
export async function fetchCatalog(): Promise<Catalog> {
  return new Catalog(await apiGet<MasterData>("/api/master-data"));
}
