import { redirect } from "next/navigation";
import { now } from "@/lib/clock";
import { campusDate } from "@/lib/domain/priority";
import { requireUser } from "@/lib/session";
import { getCatalog } from "@/lib/services/catalog";
import { NewTicketForm } from "./form";

export const metadata = { title: "Raise a request" };

const days = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h}h`);

export default async function NewTicketPage() {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/tickets");
  const catalog = await getCatalog();
  const categories = catalog.activeCategories.map((c) => {
    const p = catalog.priority(c.defaultPriority);
    return {
      value: c.code,
      label: c.label,
      hint: `Handled by ${catalog.teamLabel(c.team)} · ${p.label} priority · first reply within ${p.responseHours}h, resolved within ${days(p.resolutionHours)}`,
    };
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Raise a request</h1>
        <p className="text-sm text-slate-600">It goes straight to the right office. You&apos;ll be notified at every step.</p>
      </div>
      <NewTicketForm categories={categories} today={campusDate(now())} />
    </div>
  );
}
