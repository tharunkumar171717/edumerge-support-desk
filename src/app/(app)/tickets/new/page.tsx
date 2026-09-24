import { redirect } from "next/navigation";
import { now } from "@/lib/clock";
import { campusDate } from "@/lib/domain/priority";
import { CATEGORY_CONFIG, PRIORITY_LABELS, SLA_HOURS, TEAM_LABELS } from "@/lib/domain/config";
import { CATEGORIES } from "@/lib/domain/types";
import { requireUser } from "@/lib/session";
import { NewTicketForm } from "./form";

export const metadata = { title: "Raise a request · Student Support Desk" };

export default async function NewTicketPage() {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/tickets");
  const categories = CATEGORIES.map((c) => {
    const cfg = CATEGORY_CONFIG[c];
    const [resp, reso] = SLA_HOURS[cfg.priority];
    return { value: c, label: cfg.label, hint: `Handled by ${TEAM_LABELS[cfg.team]} · ${PRIORITY_LABELS[cfg.priority]} priority · first reply within ${resp}h, resolved within ${reso / 24} days` };
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
