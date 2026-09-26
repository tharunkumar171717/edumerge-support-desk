import { z } from "zod";
import { DomainError, type DomainErrorCode } from "@/lib/domain/errors";

/** An error with an HTTP status. Body: `{ error: { code, message }, ...extra }`. */
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

// Business-rule errors from the domain layer, mapped to HTTP.
const DOMAIN_STATUS: Record<DomainErrorCode, number> = {
  VALIDATION: 422,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STALE_VERSION: 409,
  INVALID_TRANSITION: 409,
};

/** The one place thrown errors become responses (like Express's error-handling middleware). */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: { code: e.code, message: e.message }, ...e.extra }, { status: e.status });
  }
  if (e instanceof DomainError) {
    return Response.json({ error: { code: e.code, message: e.message } }, { status: DOMAIN_STATUS[e.code] });
  }
  if (e instanceof z.ZodError) {
    return Response.json({ error: { code: "VALIDATION", message: e.issues[0]?.message ?? "Please check the request." } }, { status: 422 });
  }
  console.error(e);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}
