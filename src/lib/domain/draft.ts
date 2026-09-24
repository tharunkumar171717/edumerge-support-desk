import { pickAssignee, type StaffLoad } from "./assign";
import { STATUS_LABELS, teamForCategory, TEAM_LABELS } from "./config";
import { forbidden, stale } from "./errors";
import { assertTransition } from "./transitions";
import type { NewComment, NewNotification, Status, Ticket, TicketEvent, User } from "./types";

export interface Ctx {
  actor: User | null; // null = the system (sweep, auto-assign)
  now: Date;
  staff: StaffLoad[]; // every staff member, active or not, with current open-ticket counts
  managerIds: number[];
}

export type EventDraft = Omit<TicketEvent, "ticketId">;
export type CommentDraft = Omit<NewComment, "ticketId">;
export type NotificationDraft = Omit<NewNotification, "ticketId">;

export interface Outcome {
  ticket: Ticket;
  events: EventDraft[];
  comments: CommentDraft[];
  notifications: NotificationDraft[];
}

/** Accumulates one action's changes so every action produces a consistent, auditable outcome. */
export class Draft {
  t: Ticket;
  events: EventDraft[] = [];
  comments: CommentDraft[] = [];
  notifications: NotificationDraft[] = [];

  constructor(
    ticket: Ticket,
    readonly ctx: Ctx,
  ) {
    this.t = { ...ticket };
  }

  get actor(): User {
    if (!this.ctx.actor) throw forbidden();
    return this.ctx.actor;
  }

  get now(): Date {
    return this.ctx.now;
  }

  checkVersion(expected: number): this {
    if (expected !== this.t.version) throw stale();
    return this;
  }

  event(kind: string, fromValue: string | null = null, toValue: string | null = null, note: string | null = null) {
    this.events.push({ actorId: this.ctx.actor?.id ?? null, kind, fromValue, toValue, note, createdAt: this.now });
  }

  move(to: Status, note: string | null = null) {
    const from = this.t.status;
    assertTransition(from, to);
    this.t.status = to;
    this.event("status_changed", STATUS_LABELS[from], STATUS_LABELS[to], note);
  }

  comment(body: string, isInternal: boolean) {
    this.comments.push({ authorId: this.actor.id, body, isInternal, createdAt: this.now });
  }

  notify(userIds: (number | null | undefined)[], message: string) {
    const self = this.ctx.actor?.id;
    for (const id of new Set(userIds)) {
      if (id != null && id !== self) this.notifications.push({ userId: id, message });
    }
  }

  /** First visible staff action stops the first-response clock. */
  markFirstResponse() {
    if (this.ctx.actor && this.ctx.actor.role !== "STUDENT" && !this.t.firstResponseAt) {
      this.t.firstResponseAt = this.now;
    }
  }

  staffName(id: number | null): string | null {
    if (id == null) return null;
    return this.ctx.staff.find((s) => s.id === id)?.name ?? `User #${id}`;
  }

  /** Give the ticket to the least-loaded active teammate, or leave it in the queue and alert managers. */
  autoAssign(excludeId?: number) {
    const team = teamForCategory(this.t.category);
    const pick = pickAssignee(this.ctx.staff, team, excludeId);
    if (!pick) {
      this.t.assigneeId = null;
      if (this.t.status === "RESOLVED") this.move("NEW", "No active staff in team");
      this.event("queued", null, TEAM_LABELS[team], `No active staff in ${TEAM_LABELS[team]}`);
      this.notify(this.ctx.managerIds, `No active staff in ${TEAM_LABELS[team]}; ticket is waiting unassigned`);
      return;
    }
    this.t.assigneeId = pick.id;
    pick.openCount += 1;
    if (this.t.status === "NEW" || this.t.status === "RESOLVED") this.move("ASSIGNED");
    this.event("auto_assigned", null, pick.name, "Least-loaded active staff member");
    this.notify([pick.id], "A ticket was assigned to you");
  }

  done(bumpVersion = true): Outcome {
    this.t.updatedAt = this.now;
    if (bumpVersion) this.t.version += 1;
    return { ticket: this.t, events: this.events, comments: this.comments, notifications: this.notifications };
  }
}
