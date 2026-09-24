import { describe, expect, it } from "vitest";
import { availableActions, canComment, canPickUp, canView, canWork } from "@/lib/domain/permissions";
import { addComment, pickUp, resolve } from "@/lib/domain/workflow";
import { accounts1, accounts2, ctx, exams1, makeTicket, manager, otherStudent, student } from "./fixtures";

describe("permissions", () => {
  const ticket = makeTicket();

  it("a student can view only their own ticket", () => {
    expect(canView(student, ticket)).toBe(true);
    expect(canView(otherStudent, ticket)).toBe(false);
  });

  it("a student can never post an internal note", () => {
    expect(canComment(student, ticket, true)).toBe(false);
    expect(() => addComment(ticket, 1, "psst", true, ctx(student))).toThrow(/internal/);
    expect(availableActions(student, ticket).has("comment_internal")).toBe(false);
  });

  it("staff see their team's queue but not other teams' tickets", () => {
    expect(canView(accounts2, ticket)).toBe(true);
    expect(canView(exams1, ticket)).toBe(false);
  });

  it("staff can't pick up another team's ticket", () => {
    const queued = makeTicket({ status: "NEW", assigneeId: null });
    expect(canPickUp(exams1, queued)).toBe(false);
    expect(() => pickUp(queued, 1, ctx(exams1))).toThrow(/own team/);
    expect(canPickUp(accounts2, queued)).toBe(true);
  });

  it("staff can't act on a ticket they don't own, even in their team", () => {
    expect(canWork(accounts2, ticket)).toBe(false);
    expect(() => resolve(ticket, 1, "done", ctx(accounts2))).toThrow(/owner or a manager/);
    expect(availableActions(accounts2, ticket).size).toBe(0);
  });

  it("a manager can view and work any ticket", () => {
    expect(canView(manager, ticket)).toBe(true);
    expect(canWork(manager, ticket)).toBe(true);
    const out = resolve(ticket, 1, "Receipt regenerated", ctx(manager));
    expect(out.ticket.status).toBe("RESOLVED");
  });

  it("a deactivated staff member loses the right to work their tickets", () => {
    expect(canWork({ ...accounts1, isActive: false }, ticket)).toBe(false);
  });

  it("offers owners only the actions their status allows", () => {
    const acts = availableActions(accounts1, ticket);
    expect([...acts].sort()).toEqual(
      ["change_priority", "comment_internal", "comment_public", "request_info", "resolve", "start"].sort(),
    );
  });
});
