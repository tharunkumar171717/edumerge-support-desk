"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-600">We couldn&apos;t load this page. It may be a brief connection problem with the database.</p>
      <button onClick={reset} className="btn-primary mt-4">Try again</button>
    </div>
  );
}
