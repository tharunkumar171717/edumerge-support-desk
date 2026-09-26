import { models, type Transaction } from "@/lib/db";
import { Catalog } from "@/lib/domain/catalog";

// Master data changes rarely, so each server instance reuses it briefly instead of re-reading
// three tables on every request. Edits made in the database show up within this window.
const TTL_MS = 60_000;
let cached: { at: number; catalog: Catalog } | null = null;

/**
 * Teams, priorities and categories from the database. Inside a transaction pass it in: the pool
 * has a single connection, so a query outside the transaction would wait on ourselves.
 */
export async function getCatalog(transaction?: Transaction): Promise<Catalog> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.catalog;
  const { TeamModel, PriorityModel, CategoryModel } = models();
  const [teams, priorities, categories] = await Promise.all([
    TeamModel.findAll({ order: [["sortOrder", "ASC"], ["code", "ASC"]], transaction }),
    PriorityModel.findAll({ order: [["rank", "ASC"]], transaction }),
    CategoryModel.findAll({ order: [["sortOrder", "ASC"], ["code", "ASC"]], transaction }),
  ]);
  const catalog = new Catalog({
    teams: teams.map((t) => ({ code: t.code, label: t.label, sortOrder: t.sortOrder })),
    // NUMERIC arrives as a string; SLA hours are small, so Number is exact enough.
    priorities: priorities.map((p) => ({ code: p.code, label: p.label, rank: p.rank, responseHours: Number(p.responseHours), resolutionHours: Number(p.resolutionHours) })),
    categories: categories.map((c) => ({ code: c.code, label: c.label, team: c.teamCode, defaultPriority: c.defaultPriority, sortOrder: c.sortOrder, isActive: c.isActive })),
  });
  cached = { at: Date.now(), catalog };
  return catalog;
}

export function clearCatalogCache(): void {
  cached = null;
}
