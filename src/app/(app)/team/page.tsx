import { redirect } from "next/navigation";
import { now as clockNow } from "@/lib/clock";
import { requireUser } from "@/lib/session";
import { getCatalog } from "@/lib/services/catalog";
import { dashboardReport } from "@/lib/services/reports";
import { StaffToggle } from "./staff-toggle";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/");
  const [{ staff }, catalog] = await Promise.all([dashboardReport(clockNow()), getCatalog()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Team</h1>
        <p className="text-sm text-slate-600">
          Deactivating someone (leave, exit) sends their open tickets back through auto-assign within the same team; waiting tickets keep their status. If nobody else is active, tickets stay in the queue and you&apos;re notified.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {catalog.teams.map(({ code: key, label }) => {
          const members = staff.filter((s) => s.team === key);
          const active = members.filter((m) => m.isActive).length;
          return (
            <section key={key} className="card">
              <h2 className="flex items-center justify-between text-sm font-semibold text-slate-900">
                {label}
                <span className={`text-xs font-normal ${active ? "text-slate-500" : "text-red-600"}`}>{active} of {members.length} active</span>
              </h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <div className={`text-sm font-medium ${m.isActive ? "text-slate-900" : "text-slate-400"}`}>{m.name}</div>
                      <div className="text-xs text-slate-500">
                        {m.open} open · {m.breached} breached · {m.resolved7d} resolved this week
                      </div>
                    </div>
                    <StaffToggle staffId={m.id} name={m.name} isActive={m.isActive} open={m.open} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
