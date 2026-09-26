import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { DomainError, type DomainErrorCode } from "@/lib/domain/errors";
import type { User } from "@/lib/domain/types";
import { currentUser } from "@/lib/session";

/** Error body for every API failure: `{ error: { code, message }, ...extra }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const DOMAIN_STATUS: Record<DomainErrorCode, number> = {
  VALIDATION: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STALE_VERSION: 409,
  INVALID_TRANSITION: 409,
};

function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: { code: e.code, message: e.message }, ...e.extra }, { status: e.status });
  }
  if (e instanceof DomainError) {
    return Response.json({ error: { code: e.code, message: e.message } }, { status: DOMAIN_STATUS[e.code] });
  }
  if (e instanceof z.ZodError) {
    const message = e.issues[0]?.message ?? "Please check the request.";
    return Response.json({ error: { code: "VALIDATION", message } }, { status: 422 });
  }
  console.error(e);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/** Wraps a route handler so thrown domain, validation and HTTP errors become JSON responses. */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** The signed-in user, or 401. Role and active flag are always read fresh from the database. */
export async function apiUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in again.");
  return user;
}

/**
 * Parses a JSON, form-data or urlencoded body against a schema (form values arrive as strings;
 * the schemas coerce them). Cross-site posts don't carry the SameSite=Lax session cookie, so they
 * fail authentication whatever the body type.
 */
export async function readBody<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.output<S>> {
  const type = req.headers.get("content-type") ?? "";
  let raw: unknown;
  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    raw = Object.fromEntries([...form].filter(([, v]) => typeof v === "string"));
  } else if (!type || type.includes("json") || type.startsWith("text/plain")) {
    // JSON, including clients that send it without (or with a text) content type; empty means {}.
    const text = await req.text();
    try {
      raw = text.trim() ? JSON.parse(text) : {};
    } catch {
      throw new HttpError(400, "BAD_JSON", "The request body is not valid JSON.");
    }
  } else {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the body as JSON, form-data or x-www-form-urlencoded.");
  }
  return schema.parse(raw);
}

/** Positive integer id from a route segment, or 404 (bad ids look the same as missing ones). */
export function parseId(raw: string, what = "Ticket"): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "NOT_FOUND", `${what} not found.`);
  return id;
}
