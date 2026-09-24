import type { Team } from "./types";

export interface StaffLoad {
  id: number;
  name: string;
  team: Team | null;
  isActive: boolean;
  openCount: number;
}

/** Least-loaded active staff member in the team; ties go to the lowest id. Null if nobody is active. */
export function pickAssignee(staff: StaffLoad[], team: Team, excludeId?: number): StaffLoad | null {
  const pool = staff
    .filter((s) => s.team === team && s.isActive && s.id !== excludeId)
    .sort((a, b) => a.openCount - b.openCount || a.id - b.id);
  return pool[0] ?? null;
}
