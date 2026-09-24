// Plain CSS bars: the data is small and a chart library would add weight for no gain.

export function BarList({ data, color = "bg-indigo-500", unit = "" }: { data: { label: string; value: number }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate text-slate-600">{d.label}</span>
          <span className="h-3 overflow-hidden rounded bg-slate-100">
            <span className={`block h-full rounded ${color}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums text-slate-900">{d.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({ data }: { data: { day: string; created: number; resolved: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const short = (day: string) => new Date(`${day}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Created</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Resolved</span>
      </div>
      <div className="flex h-40 items-end gap-1 border-b border-slate-200" role="img" aria-label="Tickets created versus resolved per day over the last 14 days">
        {data.map((d) => (
          <div key={d.day} className="flex h-full flex-1 items-end justify-center gap-px" title={`${short(d.day)}: ${d.created} created, ${d.resolved} resolved`}>
            <span className="w-1/2 max-w-3 rounded-t bg-indigo-500" style={{ height: `${(d.created / max) * 100}%` }} />
            <span className="w-1/2 max-w-3 rounded-t bg-emerald-500" style={{ height: `${(d.resolved / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-slate-500">
        {data.map((d, i) => (
          <span key={d.day} className="flex-1 text-center">{i % 2 === 0 ? short(d.day) : ""}</span>
        ))}
      </div>
    </div>
  );
}
