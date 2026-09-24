export type DomainErrorCode = "FORBIDDEN" | "INVALID_TRANSITION" | "STALE_VERSION" | "VALIDATION" | "NOT_FOUND";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const forbidden = (msg = "You don't have permission to do that.") => new DomainError("FORBIDDEN", msg);
export const invalid = (msg: string) => new DomainError("VALIDATION", msg);
export const stale = () =>
  new DomainError("STALE_VERSION", "This ticket was updated by someone else. Reload to see the latest version.");
export const notFound = (msg = "Ticket not found.") => new DomainError("NOT_FOUND", msg);

export function friendlyMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  return "Something went wrong. Please try again.";
}
