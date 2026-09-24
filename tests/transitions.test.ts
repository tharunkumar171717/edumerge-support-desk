import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import { assertTransition, canTransition, TRANSITIONS } from "@/lib/domain/transitions";
import { STATUSES, type Status } from "@/lib/domain/types";

const allowed: [Status, Status][] = Object.entries(TRANSITIONS).flatMap(([from, tos]) =>
  tos.map((to) => [from as Status, to] as [Status, Status]),
);

describe("status transitions", () => {
  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ["CLOSED", "IN_PROGRESS"],
    ["NEW", "RESOLVED"],
    ["NEW", "IN_PROGRESS"],
    ["WAITING_ON_STUDENT", "CANCELLED"],
    ["IN_PROGRESS", "CANCELLED"],
    ["RESOLVED", "IN_PROGRESS"],
  ] as [Status, Status][])("rejects %s → %s", (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(DomainError);
  });

  it("CANCELLED and CLOSED are terminal: nothing leaves them", () => {
    for (const to of STATUSES) {
      expect(canTransition("CANCELLED", to)).toBe(false);
      expect(canTransition("CLOSED", to)).toBe(false);
    }
  });

  it("error carries the INVALID_TRANSITION code and a readable message", () => {
    try {
      assertTransition("CLOSED", "IN_PROGRESS");
    } catch (e) {
      expect((e as DomainError).code).toBe("INVALID_TRANSITION");
      expect((e as DomainError).message).toBe("A ticket can't move from Closed to In progress.");
    }
  });
});
