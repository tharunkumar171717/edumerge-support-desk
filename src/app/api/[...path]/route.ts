import type { NextRequest } from "next/server";
import { apiRouter } from "@/api/routes";

// Single entry point for /api/*: Next.js hands every request to the router in src/api,
// which runs the route's middlewares and controller.
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: RouteContext<"/api/[...path]">): Promise<Response> {
  const { path } = await ctx.params;
  return apiRouter.handle(req, `/${path.join("/")}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
