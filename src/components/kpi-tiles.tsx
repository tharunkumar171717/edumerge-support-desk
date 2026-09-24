import type { DashboardReport } from "@/lib/services/reports";

const hrs = (h: number | null) => (h == null ? "—" : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);
const pct = (p: number | null) => (p == null ? "—" : `${p}%`);

export function KpiTiles({ kpis }: { kpis: DashboardReport["kpis"] }) {
  const tiles = [
    { label: "Open tickets", value: String(kpis.open) },
    { label: "SLA breached", value: String(kpis.breached), bad: kpis.breached > 0 },
    { label: "Escalated", value: String(kpis.escalated), bad: kpis.escalated > 0 },
    { label: "Unassigned", value: String(kpis.unassigned), bad: kpis.unassigned > 0 },
    { label: "Response SLA met", value: pct(kpis.responseCompliance) },
    { label: "Resolution SLA met", value: pct(kpis.resolutionCompliance) },
    { label: "Avg first response", value: hrs(kpis.firstResponseHours) },
    { label: "Avg resolution", value: hrs(kpis.resolutionHours) },
    { label: "Reopen rate", value: pct(kpis.reopenRate) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="card p-3">
          <div className="text-xs font-medium text-slate-500">{t.label}</div>
          <div className={`mt-1 text-2xl font-semibold ${t.bad ? "text-red-600" : "text-slate-900"}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}
