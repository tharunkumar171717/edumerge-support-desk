import { isOpen, teamForCategory, TERMINAL_STATUSES } from "./config";
import { forbidden } from "./errors";
import type { Ticket, User } from "./types";

type T = Pick<Ticket, "studentId" | "assigneeId" | "category" | "status">;

export function canView(user: User, ticket: T): boolean {
  if (user.role === "MANAGER") return true;
  if (user.role === "STUDENT") return ticket.studentId === user.id;
  return ticket.assigneeId === user.id || user.team === teamForCategory(ticket.category);
}

export function isOwnStudent(user: User, ticket: T): boolean {
  return user.role === "STUDENT" && ticket.studentId === user.id;
}

/** Owner-level work: start, request info, resolve, change priority, internal notes. */
export function canWork(user: User, ticket: T): boolean {
  if (!user.isActive) return false;
  if (user.role === "MANAGER") return true;
  return user.role === "STAFF" && ticket.assigneeId !== null && ticket.assigneeId === user.id;
}

/** Staff may only take unowned work from their own team's queue. */
export function canPickUp(user: User, ticket: T): boolean {
  return (
    user.role === "STAFF" &&
    user.isActive &&
    ticket.assigneeId === null &&
    (ticket.status === "NEW" || ticket.status === "WAITING_ON_STUDENT") &&
    user.team === teamForCategory(ticket.category)
  );
}

export function canAssign(user: User, ticket: T): boolean {
  return user.role === "MANAGER" && user.isActive && isOpen(ticket.status);
}

export function canComment(user: User, ticket: T, internal: boolean): boolean {
  if (TERMINAL_STATUSES.includes(ticket.status)) return false;
  if (user.role === "STUDENT") return !internal && isOwnStudent(user, ticket);
  return canWork(user, ticket);
}

export function canCancel(user: User, ticket: T): boolean {
  // Once work has started the request can only be resolved, not withdrawn.
  return isOwnStudent(user, ticket) && (ticket.status === "NEW" || ticket.status === "ASSIGNED");
}

export function canConfirmOrReopen(user: User, ticket: T): boolean {
  return isOwnStudent(user, ticket) && ticket.status === "RESOLVED";
}

export type TicketAction =
  | "pick_up"
  | "assign"
  | "start"
  | "request_info"
  | "resolve"
  | "change_priority"
  | "comment_public"
  | "comment_internal"
  | "reply"
  | "cancel"
  | "close"
  | "reopen";

/** Everything the UI should offer this user on this ticket; each action re-checks on the server. */
export function availableActions(user: User, ticket: T): Set<TicketAction> {
  const a = new Set<TicketAction>();
  if (!canView(user, ticket)) return a;
  const s = ticket.status;
  if (canPickUp(user, ticket)) a.add("pick_up");
  if (canAssign(user, ticket)) a.add("assign");
  if (canWork(user, ticket) && isOpen(s)) {
    if (s === "ASSIGNED") a.add("start");
    if (s === "ASSIGNED" || s === "IN_PROGRESS") a.add("request_info");
    if (s !== "NEW") a.add("resolve");
    a.add("change_priority");
  }
  if (canComment(user, ticket, false)) a.add(s === "WAITING_ON_STUDENT" && user.role === "STUDENT" ? "reply" : "comment_public");
  if (canComment(user, ticket, true)) a.add("comment_internal");
  if (canCancel(user, ticket)) a.add("cancel");
  if (canConfirmOrReopen(user, ticket)) {
    a.add("close");
    a.add("reopen");
  }
  return a;
}

export function requireView(user: User, ticket: T): void {
  if (!canView(user, ticket)) throw forbidden("You can't view this ticket.");
}
