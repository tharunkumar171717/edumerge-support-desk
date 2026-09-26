import { apiUser, handler } from "@/lib/api/http";
import { getCatalog } from "@/lib/services/catalog";

/** GET /api/master-data: teams, priorities (with SLA hours) and categories. */
export const GET = handler(async () => {
  await apiUser();
  const { data } = await getCatalog();
  return Response.json(data);
});
