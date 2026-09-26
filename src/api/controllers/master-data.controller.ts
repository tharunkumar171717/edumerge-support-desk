import { getCatalog } from "@/lib/services/catalog";
import type { Controller } from "../core/router";

/** GET /api/master-data: teams, priorities (with SLA hours) and categories from the database. */
export const getMasterData: Controller = async () => {
  const { data } = await getCatalog();
  return Response.json(data);
};
