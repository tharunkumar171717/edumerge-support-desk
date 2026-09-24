import { timingSafeEqual } from "node:crypto";
import { runSlaSweep } from "@/lib/services/sweep";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Vercel Cron calls this every 15 minutes with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runSlaSweep();
  return Response.json({ ok: true, ...result });
}
