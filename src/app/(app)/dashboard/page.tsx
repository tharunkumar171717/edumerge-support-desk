import Link from "next/link";
import { redirect } from "next/navigation";
import { BarList, TrendChart } from "@/components/charts";
import { KpiTiles } from "@/components/kpi-tiles";
import { now as clockNow } from "@/lib/clock";
import { TEAM_LABELS } from "@/lib/domain/config";
import { requireUser } from "@/lib/session";
import { dashboardReport } from "@/lib/services/reports";
import { maybeRunSweep } from "@/lib/services/sweep";

export const metadata = { title: "Dashboard · Student Support Desk" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/");
  await maybeRunSweep();
  const r = await dashboardReport(clockNow());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Management dashboard</h1>
        <p className="text-sm text-slate-600">Live from ticket state. Compliance counts closed-out clocks plus open tickets already past due.</p>
      </div>
      <KpiTiles kpis={r.kpis} />

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Open by status</h2>
          <BarList data={r.byStatus.map((s) => ({ label: s.label, value: s.value }))} />
        </section>
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Open by category</h2>
          <BarList data={r.byCategory} color="bg-violet-500" />
        </section>
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Ageing of open tickets</h2>
          <BarList data={r.ageBuckets} color="bg-amber-500" />
        </section>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Created vs resolved, last 14 days</h2>
        <TrendChart data={r.trend} />
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Staff workload</h2>
        <table className="mt-2 w-full min-w-[36rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Staff</th>
              <th className="px-4 py-2 font-medium">Team</th>
              <th className="px-4 py-2 text-right font-medium">Open</th>
              <th className="px-4 py-2 text-right font-medium">Breached</th>
              <th className="px-4 py-2 text-right font-medium">Resolved (7d)</th>
              <th className="px-4 py-2 text-right font-medium">Avg resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.staff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">
                  <Link href={`/tickets?assignee=${s.id}&status=OPEN`} className="font-medium text-slate-900 hover:text-indigo-700">{s.name}</Link>
                  {!s.isActive && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">inactive</span>}
                </td>
                <td className="px-4 py-2 text-slate-600">{TEAM_LABELS[s.team as keyof typeof TEAM_LABELS]}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.open}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${s.breached ? "font-semibold text-red-600" : ""}`}>{s.breached}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.resolved7d}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.avgResolutionHours == null ? "—" : `${s.avgResolutionHours.toFixed(1)}h`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
