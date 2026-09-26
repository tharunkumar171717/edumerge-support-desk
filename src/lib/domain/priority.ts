import type { Catalog } from "./catalog";
import { CAMPUS_TIMEZONE, URGENT_NEED_WINDOW_DAYS } from "./config";
import type { Category, Priority } from "./types";

/** Calendar date (YYYY-MM-DD) on campus for an instant. */
export function campusDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAMPUS_TIMEZONE }).format(now);
}

/** Whole campus-calendar days from today until the given date (negative if past). */
export function daysUntil(date: string, now: Date): number {
  const today = Date.parse(`${campusDate(now)}T00:00:00Z`);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}

/**
 * Students never pick priority (everyone would pick Urgent). It comes from the category,
 * and a genuine near deadline raises it to at least High.
 */
export function initialPriority(catalog: Catalog, category: Category, neededBy: string | null, now: Date): Priority {
  const base = catalog.category(category).defaultPriority;
  if (neededBy && daysUntil(neededBy, now) <= URGENT_NEED_WINDOW_DAYS) return catalog.maxPriority(base, "HIGH");
  return base;
}
