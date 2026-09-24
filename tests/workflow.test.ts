import { describe, expect, it } from "vitest";
import { pickAssignee } from "@/lib/domain/assign";
import { sweepTicket } from "@/lib/domain/sweep";
import {
  addComment,
  assign,
  cancel,
  confirmClose,
  createTicket,
  releaseFromStaff,
  reopen,
  resolve,
  start,
} from "@/lib/domain/workflow";
import { accounts1, accounts2, ctx, exams1, hours, makeTicket, manager, otherStudent, staffPool, student } from "./fixtures";

describe("auto-assign", () => {
  it("picks the least-loaded active staff member in the owning team", () => {
    const pool = staffPool({ 10: { openCount: 4 }, 11: { openCount: 1 } });
    expect(pickAssignee(pool, "ACCOUNTS")?.id).toBe(11);
  });

  it("breaks ties by lowest id", () => {
    expect(pickAssignee(staffPool({ 10: { openCount: 2 }, 11: { openCount: 2 } }), "ACCOUNTS")?.id).toBe(10);
  });

  it("returns null when the team has nobody active", () => {
    expect(pickAssignee(staffPool({ 20: { isActive: false } }), "EXAMS")).toBeNull();
    expect(pickAssignee(staffPool(), "ADMIN_OFFICE")).toBeNull();
  });

  it("a new ticket with nobody active stays NEW and managers are notified", () => {
    const out = createTicket(
      { category: "ID_CARD", subject: "Lost ID card", description: "Lost it in the bus", neededBy: null },
      ctx(student),
    );
    expect(out.ticket.status).toBe("NEW");
    expect(out.ticket.assigneeId).toBeNull();
    expect(out.notifications.map((n) => n.userId)).toEqual([manager.id]);
  });

  it("a new ticket is routed to the owning team and assigned", () => {
    const out = createTicket(
      { category: "CERTIFICATES", subject: "Bonafide certificate", description: "For bank loan", neededBy: null },
      ctx(student),
    );
    expect(out.ticket).toMatchObject({ status: "ASSIGNED", assigneeId: exams1.id, priority: "HIGH" });
    expect(out.events.map((e) => e.kind)).toEqual(["created", "status_changed", "auto_assigned"]);
  });

  it("deactivating the owner re-homes open work with a teammate", () => {
    const pool = staffPool({ 10: { isActive: false } });
    const out = releaseFromStaff(makeTicket({ status: "IN_PROGRESS" }), accounts1.id, ctx(manager, hours(1), pool));
    expect(out.ticket).toMatchObject({ status: "ASSIGNED", assigneeId: accounts2.id });
  });

  it("a waiting ticket keeps its status when its owner is deactivated", () => {
    const pool = staffPool({ 20: { isActive: false } });
    const t = makeTicket({ category: "CERTIFICATES", assigneeId: exams1.id, status: "WAITING_ON_STUDENT", pausedAt: hours(1) });
    const out = releaseFromStaff(t, exams1.id, ctx(manager, hours(2), pool));
    expect(out.ticket).toMatchObject({ status: "WAITING_ON_STUDENT", assigneeId: null });
  });
});

describe("SLA sweep", () => {
  it("escalates to level 1 when first response is breached", () => {
    const out = sweepTicket(makeTicket(), ctx(null, hours(9)))!;
    expect(out.ticket.escalationLevel).toBe(1);
    expect(out.notifications.map((n) => n.userId).sort()).toEqual([accounts1.id, manager.id].sort());
  });

  it("escalates to level 2 when resolution is breached", () => {
    const t = makeTicket({ firstResponseAt: hours(1), status: "IN_PROGRESS" });
    const out = sweepTicket(t, ctx(null, hours(73)))!;
    expect(out.ticket.escalationLevel).toBe(2);
    expect(out.events).toHaveLength(1);
  });

  it("is idempotent: a second run changes nothing", () => {
    const t = makeTicket();
    const first = sweepTicket(t, ctx(null, hours(80)))!;
    expect(first.ticket.escalationLevel).toBe(2);
    expect(sweepTicket(first.ticket, ctx(null, hours(80)))).toBeNull();
    expect(sweepTicket(first.ticket, ctx(null, hours(90)))).toBeNull();
  });

  it("never escalates resolution while paused", () => {
    const t = makeTicket({ firstResponseAt: hours(1), status: "WAITING_ON_STUDENT", pausedAt: hours(2) });
    const out = sweepTicket(t, ctx(null, hours(40)));
    expect(out).toBeNull();
  });

  it("reminds a silent student once per waiting period after 48h", () => {
    const t = makeTicket({ firstResponseAt: hours(1), status: "WAITING_ON_STUDENT", pausedAt: hours(1) });
    const once = sweepTicket(t, ctx(null, hours(50)))!;
    expect(once.notifications).toEqual([{ userId: student.id, message: expect.stringMatching(/Reminder/) }]);
    expect(sweepTicket(once.ticket, ctx(null, hours(60)))).toBeNull();
  });

  it("auto-closes a resolved ticket after 72h with no response", () => {
    const t = makeTicket({ firstResponseAt: hours(1), status: "RESOLVED", resolvedAt: hours(5) });
    expect(sweepTicket(t, ctx(null, hours(70)))).toBeNull();
    const out = sweepTicket(t, ctx(null, hours(78)))!;
    expect(out.ticket).toMatchObject({ status: "CLOSED", version: 2 });
    expect(out.events[0]).toMatchObject({ actorId: null, toValue: "Closed" });
    expect(sweepTicket(out.ticket, ctx(null, hours(80)))).toBeNull();
  });
});

describe("reopen", () => {
  const resolved = makeTicket({ firstResponseAt: hours(1), status: "RESOLVED", resolvedAt: hours(80), escalationLevel: 2 });

  it("gives a fresh resolution window and increments reopen_count", () => {
    const out = reopen(resolved, 1, "Receipt still shows old amount", ctx(student, hours(90)));
    expect(out.ticket).toMatchObject({ status: "ASSIGNED", reopenCount: 1, resolvedAt: null, escalationLevel: 0 });
    expect(out.ticket.slaStartAt).toEqual(hours(90));
    expect(out.ticket.resolutionDueAt).toEqual(hours(90 + 72));
  });

  it("only from RESOLVED", () => {
    expect(() => reopen(makeTicket({ status: "CLOSED" }), 1, "why", ctx(student))).toThrow();
    expect(() => reopen(makeTicket({ status: "IN_PROGRESS" }), 1, "why", ctx(student))).toThrow();
  });

  it("only by the owning student, and a reason is required", () => {
    expect(() => reopen(resolved, 1, "not mine", ctx(otherStudent))).toThrow(/Only the student/);
    expect(() => reopen(resolved, 1, "nope", ctx(manager))).toThrow(/Only the student/);
    expect(() => reopen(resolved, 1, "   ", ctx(student))).toThrow(/why/);
  });
});

describe("waiting on student", () => {
  const waiting = makeTicket({ firstResponseAt: hours(1), status: "WAITING_ON_STUDENT", pausedAt: hours(2) });

  it("a reply with no owner goes back to the queue and alerts managers", () => {
    const out = addComment({ ...waiting, assigneeId: null }, 1, "Here is the UTR", false, ctx(student, hours(5)));
    expect(out.ticket.status).toBe("NEW");
    expect(out.ticket.pausedAt).toBeNull();
    expect(out.notifications.map((n) => n.userId)).toEqual([manager.id]);
  });

  it("resolving while waiting counts the paused time before stopping the clock", () => {
    const out = resolve(waiting, 1, "Fixed after checking the bank statement", ctx(accounts1, hours(12)));
    expect(out.ticket).toMatchObject({ status: "RESOLVED", pausedAt: null, pausedSeconds: 10 * 3600 });
    expect(out.ticket.resolutionDueAt).toEqual(hours(72 + 10));
  });
});

describe("student actions", () => {
  it("cancel only when NEW or ASSIGNED", () => {
    expect(cancel(makeTicket(), 1, "Solved offline", ctx(student)).ticket.status).toBe("CANCELLED");
    expect(() => cancel(makeTicket({ status: "IN_PROGRESS" }), 1, "", ctx(student))).toThrow();
  });

  it("confirm closes a resolved ticket", () => {
    const t = makeTicket({ status: "RESOLVED", resolvedAt: hours(3) });
    expect(confirmClose(t, 1, ctx(student, hours(4))).ticket).toMatchObject({ status: "CLOSED", closedAt: hours(4) });
  });
});

describe("optimistic locking", () => {
  it("rejects a stale version and changes nothing", () => {
    const t = makeTicket({ version: 3 });
    expect(() => start(t, 2, ctx(accounts1))).toThrow(/updated by someone else/);
    expect(t.status).toBe("ASSIGNED");
  });

  it("every change bumps the version", () => {
    const out = start(makeTicket({ version: 3 }), 3, ctx(accounts1));
    expect(out.ticket.version).toBe(4);
  });

  it("a manager reassigning makes the old owner's open form stale", () => {
    const t = makeTicket({ status: "IN_PROGRESS" });
    const moved = assign(t, 1, accounts2.id, ctx(manager)).ticket;
    expect(moved).toMatchObject({ status: "ASSIGNED", assigneeId: accounts2.id });
    expect(() => resolve(moved, 1, "done", ctx(accounts2))).toThrow(/updated by someone else/);
  });
});
