import { AlertOctagon, ArrowRightLeft, Bell, Flag, Lock, MessageSquare, PlusCircle, RotateCcw, UserCheck, UserMinus } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import type { EventView } from "@/lib/services/queries";

const ICONS: Record<string, typeof Flag> = {
  created: PlusCircle,
  status_changed: ArrowRightLeft,
  auto_assigned: UserCheck,
  assigned: UserCheck,
  picked_up: UserCheck,
  unassigned: UserMinus,
  queued: UserMinus,
  priority_changed: Flag,
  commented: MessageSquare,
  internal_note: Lock,
  escalated: AlertOctagon,
  reminder_sent: Bell,
  reopened: RotateCcw,
};

function describe(e: EventView): string {
  switch (e.kind) {
    case "created": return `Raised · priority ${e.toValue}`;
    case "status_changed": return `${e.fromValue} → ${e.toValue}`;
    case "auto_assigned": return `Auto-assigned to ${e.toValue}`;
    case "assigned": return e.fromValue ? `Reassigned ${e.fromValue} → ${e.toValue}` : `Assigned to ${e.toValue}`;
    case "picked_up": return `Picked up by ${e.toValue}`;
    case "unassigned": return `Unassigned from ${e.fromValue}`;
    case "queued": return `Left in the ${e.toValue} queue`;
    case "priority_changed": return `Priority ${e.fromValue} → ${e.toValue}`;
    case "commented": return "Posted a message";
    case "internal_note": return "Added an internal note";
    case "escalated": return `Escalated to level ${e.toValue}`;
    case "reminder_sent": return "Reminder sent to student";
    case "reopened": return `Reopened (#${e.toValue})`;
    default: return e.kind;
  }
}

export function Timeline({ events }: { events: EventView[] }) {
  if (!events.length) return <p className="text-sm text-slate-500">No activity yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-5">
      {events.map((e) => {
        const Icon = ICONS[e.kind] ?? Flag;
        const alarm = e.kind === "escalated";
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[1.85rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${alarm ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            <div className={`text-sm ${alarm ? "font-medium text-red-700" : "text-slate-800"}`}>{describe(e)}</div>
            {e.note && <div className="text-sm text-slate-600">{e.note}</div>}
            <div className="text-xs text-slate-500">{e.actorName ?? "System"} · {fmtDateTime(e.createdAt)}</div>
          </li>
        );
      })}
    </ol>
  );
}
