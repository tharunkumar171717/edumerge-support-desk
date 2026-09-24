import { resolutionClock, responseClock, type SlaClock } from "@/lib/domain/sla";
import type { Ticket } from "@/lib/domain/types";
import { fmtDateTime, fmtRemaining } from "@/lib/format";
import { SlaChip } from "./badges";

const BAR: Record<string, string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  breached: "bg-red-500",
  paused: "bg-slate-400",
  met: "bg-emerald-500",
  missed: "bg-red-500",
  "n/a": "bg-slate-200",
};

function Clock({ title, clock, doneAt, doneLabel }: { title: string; clock: SlaClock; doneAt: Date | null; doneLabel: string }) {
  const ratio = clock.usedRatio == null ? (clock.state === "met" || clock.state === "missed" ? 1 : 0) : clock.usedRatio;
  const width = Math.max(2, Math.min(100, ratio * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <SlaChip state={clock.state} />
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${title} time used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, ratio * 100))}
      >
        <div className={`h-full rounded-full ${BAR[clock.state]}`} style={{ width: `${width}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>
          {doneAt
            ? `${doneLabel} ${fmtDateTime(doneAt)}`
            : clock.state === "paused"
              ? `Paused · ${fmtRemaining(clock.remainingMs)} when resumed`
              : fmtRemaining(clock.remainingMs)}
        </span>
        {clock.due && <span>Due {fmtDateTime(clock.due)}</span>}
      </div>
    </div>
  );
}

export function SlaPanel({ ticket, now }: { ticket: Ticket; now: Date }) {
  const paused = ticket.pausedSeconds + (ticket.pausedAt ? Math.round((now.getTime() - ticket.pausedAt.getTime()) / 1000) : 0);
  return (
    <div className="space-y-4">
      <Clock title="First response" clock={responseClock(ticket, now)} doneAt={ticket.firstResponseAt} doneLabel="Responded" />
      <Clock title="Resolution" clock={resolutionClock(ticket, now)} doneAt={ticket.resolvedAt} doneLabel="Resolved" />
      {(paused > 0 || ticket.reopenCount > 0) && (
        <p className="text-xs text-slate-500">
          {paused > 0 && `Paused ${Math.round(paused / 360) / 10}h waiting on student (added to the due date). `}
          {ticket.reopenCount > 0 && `Reopened ${ticket.reopenCount}× · resolution clock restarted ${fmtDateTime(ticket.slaStartAt)}.`}
        </p>
      )}
    </div>
  );
}
