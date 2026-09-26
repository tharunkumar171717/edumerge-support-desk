import { invalid } from "./errors";
import type { Category, Priority, Team } from "./types";

// Master data rows as loaded from support_desk.teams / priorities / categories.
export interface TeamDef { code: Team; label: string; sortOrder: number }
export interface PriorityDef { code: Priority; label: string; rank: number; responseHours: number; resolutionHours: number }
export interface CategoryDef { code: Category; label: string; team: Team; defaultPriority: Priority; sortOrder: number; isActive: boolean }

export interface MasterData {
  teams: TeamDef[];
  priorities: PriorityDef[]; // most urgent last (ascending rank)
  categories: CategoryDef[];
}

/** Lookups over the master data. Pure: the service layer loads the rows, the domain only reads them. */
export class Catalog {
  private readonly teamMap: Map<string, TeamDef>;
  private readonly priorityMap: Map<string, PriorityDef>;
  private readonly categoryMap: Map<string, CategoryDef>;

  constructor(readonly data: MasterData) {
    this.teamMap = new Map(data.teams.map((t) => [t.code, t]));
    this.priorityMap = new Map(data.priorities.map((p) => [p.code, p]));
    this.categoryMap = new Map(data.categories.map((c) => [c.code, c]));
  }

  get teams(): TeamDef[] {
    return this.data.teams;
  }

  get priorities(): PriorityDef[] {
    return this.data.priorities;
  }

  /** Categories students can raise new requests in. */
  get activeCategories(): CategoryDef[] {
    return this.data.categories.filter((c) => c.isActive);
  }

  get categories(): CategoryDef[] {
    return this.data.categories;
  }

  category(code: string): CategoryDef {
    const c = this.categoryMap.get(code);
    if (!c) throw invalid("Choose a category.");
    return c;
  }

  priority(code: string): PriorityDef {
    const p = this.priorityMap.get(code);
    if (!p) throw invalid("Choose a valid priority.");
    return p;
  }

  teamForCategory(code: Category): Team {
    return this.category(code).team;
  }

  // Labels fall back to the raw code so a missing row never breaks a page.
  teamLabel(code: Team | null): string {
    return code ? (this.teamMap.get(code)?.label ?? code) : "";
  }

  categoryLabel(code: Category): string {
    return this.categoryMap.get(code)?.label ?? code;
  }

  priorityLabel(code: Priority): string {
    return this.priorityMap.get(code)?.label ?? code;
  }

  maxPriority(a: Priority, b: Priority): Priority {
    return this.priority(a).rank >= this.priority(b).rank ? a : b;
  }
}
