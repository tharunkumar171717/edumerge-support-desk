"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, formJson } from "@/lib/api-client";

type Cat = { value: string; label: string; hint: string };
type State = { error?: string; duplicateOf?: { id: number; subject: string } } | null;

export function NewTicketForm({ categories, today }: { categories: Cat[]; today: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>(null);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState("");
  const hint = categories.find((c) => c.value === category)?.hint;

  return (
    <form
      className="card space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // The submitter says whether this is "create anyway" after the duplicate warning.
        const body = formJson(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(async () => {
          const res = await api<{ id: number }>("/api/tickets", { method: "POST", body });
          if (res.ok) {
            router.push(`/tickets/${res.data.id}?created=1`);
            router.refresh();
          } else if (res.code === "DUPLICATE") {
            setState({ duplicateOf: res.body?.duplicateOf as { id: number; subject: string } });
          } else {
            setState({ error: res.message });
          }
        });
      }}
    >
      {state?.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.duplicateOf && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> You already have an open request in this category</p>
          <p className="mt-1">
            <Link href={`/tickets/${state.duplicateOf.id}`} className="font-medium underline">{state.duplicateOf.subject}</Link> is still open. Adding a comment there is usually faster.
          </p>
          <button name="createAnyway" value="1" className="btn-secondary mt-2" disabled={pending}>This is a different issue, create anyway</button>
        </div>
      )}
      <div>
        <label htmlFor="category" className="label">Category</label>
        <select id="category" name="category" required className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="" disabled>Choose what this is about</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <div>
        <label htmlFor="subject" className="label">Subject</label>
        <input id="subject" name="subject" required minLength={5} maxLength={120} className="input" placeholder="e.g. Fee receipt for Semester 3 not generated" />
      </div>
      <div>
        <label htmlFor="description" className="label">Details</label>
        <textarea id="description" name="description" required minLength={10} maxLength={2000} rows={5} className="input" placeholder="What happened, dates, amounts, reference numbers…" />
      </div>
      <div>
        <label htmlFor="neededBy" className="label">Needed by <span className="font-normal text-slate-500">(optional)</span></label>
        <input id="neededBy" name="neededBy" type="date" min={today} className="input sm:w-56" />
        <p className="mt-1 text-xs text-slate-500">If you need it within 2 days (e.g. a bank or visa deadline), it&apos;s prioritised automatically.</p>
      </div>
      <div className="flex justify-end gap-2">
        <Link href="/" className="btn-secondary">Cancel</Link>
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
        </button>
      </div>
    </form>
  );
}
