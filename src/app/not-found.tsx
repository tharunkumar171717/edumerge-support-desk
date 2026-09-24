import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Not found</h1>
      <p className="mt-1 text-sm text-slate-600">This page or ticket doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-primary mt-4">Go to my work</Link>
    </main>
  );
}
