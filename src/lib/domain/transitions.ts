import { STATUS_LABELS } from "./config";
import { DomainError } from "./errors";
import type { Status } from "./types";

// The only status changes the system will ever make. Every action goes through assertTransition.
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  NEW: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "WAITING_ON_STUDENT", "RESOLVED", "NEW", "CANCELLED"],
  IN_PROGRESS: ["ASSIGNED", "WAITING_ON_STUDENT", "RESOLVED", "NEW"],
  WAITING_ON_STUDENT: ["IN_PROGRESS", "NEW", "RESOLVED"],
  RESOLVED: ["CLOSED", "ASSIGNED", "NEW"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `A ticket can't move from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}.`,
    );
  }
}
