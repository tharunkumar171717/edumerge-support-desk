import { sql, type Tx } from "@/lib/db";
import { Catalog, type CategoryDef, type PriorityDef, type TeamDef } from "@/lib/domain/catalog";

type Q = Tx | typeof sql;

// Master data changes rarely, so each server instance reuses it briefly instead of re-reading
// three tables on every request. Edits made in the database show up within this window.
const TTL_MS = 60_000;
let cached: { at: number; catalog: Catalog } | null = null;

/**
 * Teams, priorities and categories from the database. Inside a transaction pass `tx`: the pool
 * has a single connection, so querying through `sql` there would wait on ourselves.
 */
export async function getCatalog(q: Q = sql): Promise<Catalog> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.catalog;
  const [teams, priorities, categories] = await Promise.all([
    q<TeamDef[]>`SELECT code, label, sort_order FROM support_desk.teams ORDER BY sort_order, code`,
    q<(Omit<PriorityDef, "responseHours" | "resolutionHours"> & { responseHours: string; resolutionHours: string })[]>`
      SELECT code, label, rank, response_hours, resolution_hours FROM support_desk.priorities ORDER BY rank`,
    q<CategoryDef[]>`
      SELECT code, label, team_code AS team, default_priority, sort_order, is_active
        FROM support_desk.categories ORDER BY sort_order, code`,
  ]);
  const catalog = new Catalog({
    teams: [...teams],
    // numeric columns arrive as strings to avoid float rounding; hours are small, so Number is exact enough.
    priorities: priorities.map((p) => ({ ...p, responseHours: Number(p.responseHours), resolutionHours: Number(p.resolutionHours) })),
    categories: [...categories],
  });
  cached = { at: Date.now(), catalog };
  return catalog;
}

export function clearCatalogCache(): void {
  cached = null;
}
