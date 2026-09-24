import { describe, expect, it } from "vitest";
import { initialPriority } from "@/lib/domain/priority";
import { pause, resolutionClock, responseClock, resume, worstSlaState } from "@/lib/domain/sla";
import { changePriority, requestInfo, addComment } from "@/lib/domain/workflow";
import { accounts1, ctx, hours, makeTicket, student, T0 } from "./fixtures";

describe("SLA clocks (MEDIUM = 8h response / 72h resolution)", () => {
  const t = makeTicket();

  it("on_track with most of the window left", () => {
    expect(responseClock(t, hours(1)).state).toBe("on_track");
    expect(resolutionClock(t, hours(10)).state).toBe("on_track");
  });

  it("at_risk when under 25% of the window remains", () => {
    expect(responseClock(t, hours(6.5)).state).toBe("at_risk"); // 1.5h of 8h left
    expect(resolutionClock(t, hours(60)).state).toBe("at_risk"); // 12h of 72h left
  });

  it("breached once the due time passes", () => {
    expect(responseClock(t, hours(9)).state).toBe("breached");
    expect(resolutionClock(t, hours(73)).state).toBe("breached");
    expect(worstSlaState(t, hours(73))).toBe("breached");
  });

  it("met vs missed after the fact", () => {
    expect(responseClock({ ...t, firstResponseAt: hours(7) }, hours(100)).state).toBe("met");
    expect(responseClock({ ...t, firstResponseAt: hours(9) }, hours(100)).state).toBe("missed");
    expect(resolutionClock({ ...t, status: "RESOLVED", resolvedAt: hours(70) }, hours(100)).state).toBe("met");
    expect(resolutionClock({ ...t, status: "RESOLVED", resolvedAt: hours(80) }, hours(100)).state).toBe("missed");
  });

  it("pausing extends the resolution due date by exactly the paused duration", () => {
    const originalDue = t.resolutionDueAt.getTime();
    const paused = pause(t, hours(10));
    expect(resolutionClock(paused, hours(200)).state).toBe("paused");
    const resumed = resume(paused, hours(10 + 37.5));
    expect(resumed.resolutionDueAt.getTime() - originalDue).toBe(37.5 * 3_600_000);
    expect(resumed.pausedSeconds).toBe(37.5 * 3600);
    expect(resumed.pausedAt).toBeNull();
  });

  it("the first-response clock is never paused", () => {
    const out = requestInfo(t, 1, "Please share the UTR number", ctx(accounts1, hours(2)));
    expect(out.ticket.firstResponseAt).toEqual(hours(2));
    expect(out.ticket.responseDueAt).toEqual(t.responseDueAt);
  });

  it("a student's reply resumes the clock and moves the ticket back to In progress", () => {
    const waiting = requestInfo(t, 1, "UTR?", ctx(accounts1, hours(2))).ticket;
    const replied = addComment(waiting, waiting.version, "UTR 1234", false, ctx(student, hours(26))).ticket;
    expect(replied.status).toBe("IN_PROGRESS");
    expect(replied.pausedSeconds).toBe(24 * 3600);
    expect(replied.resolutionDueAt).toEqual(hours(72 + 24));
  });

  it("changing priority recalculates both due dates from their start times", () => {
    const out = changePriority(t, 1, "URGENT", "Scholarship deadline tomorrow", ctx(accounts1, hours(1)));
    expect(out.ticket.responseDueAt).toEqual(hours(2));
    expect(out.ticket.resolutionDueAt).toEqual(hours(24));
    expect(out.events[0]).toMatchObject({ kind: "priority_changed", fromValue: "Medium", toValue: "Urgent" });
    expect(() => changePriority(t, 1, "LOW", "  ", ctx(accounts1))).toThrow(/reason/);
  });
});

describe("priority rule", () => {
  it("uses the category default", () => {
    expect(initialPriority("ID_CARD", null, T0)).toBe("LOW");
    expect(initialPriority("CERTIFICATES", null, T0)).toBe("HIGH");
  });

  it("'needed by' within 2 days raises priority to at least High", () => {
    expect(initialPriority("ID_CARD", "2026-09-22", T0)).toBe("HIGH");
    expect(initialPriority("FEES", "2026-09-20", T0)).toBe("HIGH");
    expect(initialPriority("FEES", "2026-09-23", T0)).toBe("MEDIUM");
  });

  it("never lowers a higher default", () => {
    expect(initialPriority("CERTIFICATES", "2026-09-21", T0)).toBe("HIGH");
  });
});
