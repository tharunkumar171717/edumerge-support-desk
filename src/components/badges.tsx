import { AlertTriangle, ArrowUp, CheckCircle2, Clock, Flame, PauseCircle, XCircle } from "lucide-react";
import { CATEGORY_CONFIG, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/domain/config";
import type { Category, Priority, SlaStateName, Status } from "@/lib/domain/types";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const STATUS_STYLE: Record<Status, string> = {
  NEW: "bg-sky-50 text-sky-700 ring-sky-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-200",
  WAITING_ON_STUDENT: "bg-amber-50 text-amber-800 ring-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200 line-through",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLE[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: "text-slate-500",
  MEDIUM: "text-sky-700",
  HIGH: "text-orange-600",
  URGENT: "text-red-600 font-semibold",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = priority === "URGENT" ? Flame : ArrowUp;
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap text-xs", PRIORITY_STYLE[priority])}>
      {(priority === "HIGH" || priority === "URGENT") && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const SLA_STYLE: Record<SlaStateName, { cls: string; label: string; Icon: typeof Clock }> = {
  on_track: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "On track", Icon: Clock },
  at_risk: { cls: "bg-amber-50 text-amber-800 ring-amber-300", label: "At risk", Icon: AlertTriangle },
  breached: { cls: "bg-red-50 text-red-700 ring-red-300", label: "Breached", Icon: XCircle },
  paused: { cls: "bg-slate-100 text-slate-600 ring-slate-200", label: "Paused", Icon: PauseCircle },
  met: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Met", Icon: CheckCircle2 },
  missed: { cls: "bg-red-50 text-red-700 ring-red-200", label: "Missed", Icon: XCircle },
  "n/a": { cls: "bg-slate-50 text-slate-400 ring-slate-200", label: "—", Icon: Clock },
};

export function SlaChip({ state, title }: { state: SlaStateName; title?: string }) {
  const s = SLA_STYLE[state];
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", s.cls)}>
      <s.Icon className="h-3 w-3" aria-hidden />
      {s.label}
    </span>
  );
}

export const slaLabel = (s: SlaStateName) => SLA_STYLE[s].label;

export function CategoryTag({ category }: { category: Category }) {
  return <span className="whitespace-nowrap text-xs text-slate-600">{CATEGORY_CONFIG[category].label}</span>;
}

export function EscalationFlag({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span title={level === 2 ? "Resolution SLA breached" : "First response SLA breached"} className="inline-flex items-center gap-0.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      <Flame className="h-3 w-3" aria-hidden />L{level}
    </span>
  );
}

export { cx };
