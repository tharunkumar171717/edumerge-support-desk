import { GraduationCap, LifeBuoy, ShieldCheck, Users } from "lucide-react";
import { LoginButton } from "@/components/session-buttons";
import type { Role, User } from "@/lib/domain/types";
import { serverApi } from "@/lib/server-api";

type LoginUser = User & { teamLabel: string | null };

export const metadata = { title: "Sign in" };

const GROUPS: { role: Role; title: string; blurb: string; Icon: typeof Users }[] = [
  { role: "STUDENT", title: "Students", blurb: "Raise requests, reply when staff need information, and confirm or reopen resolutions.", Icon: GraduationCap },
  { role: "STAFF", title: "Staff", blurb: "Work your team's queue: pick up, start, request info, resolve, and add internal notes.", Icon: Users },
  { role: "MANAGER", title: "Manager", blurb: "See everything: escalations, SLA compliance, ageing and workload; assign and manage staff.", Icon: ShieldCheck },
];

function subtitle(u: LoginUser) {
  if (u.role === "STUDENT") return u.rollNo;
  if (u.role === "STAFF") return u.teamLabel ?? "";
  return "Dean of Student Affairs";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const r = await serverApi<{ users: LoginUser[] }>("/api/session/users");
  const users = r.ok ? r.data.users : [];
  const loadError = !r.ok;
  if (!r.ok) console.error(`Sign-in users failed to load: ${r.status} ${r.code} ${r.message}`);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <LifeBuoy className="h-8 w-8 text-indigo-600" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Student Support Desk</h1>
          <p className="text-sm text-slate-600">Demo sign-in: pick a person to see the app from their side. No password needed.</p>
        </div>
      </div>
      {(error || loadError) && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError ? "Couldn't reach the database. Please try again in a moment." : "That user no longer exists. Pick another."}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {GROUPS.map(({ role, title, blurb, Icon }) => (
          <section key={role} className="card">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Icon className="h-5 w-5 text-indigo-600" aria-hidden /> {title}
            </h2>
            <p className="mb-3 mt-1 text-sm text-slate-600">{blurb}</p>
            <ul className="space-y-2">
              {users
                .filter((u) => u.role === role)
                .map((u) => (
                  <li key={u.id}>
                    <LoginButton userId={u.id}>
                      <span>
                        <span className="block font-medium text-slate-900">{u.name}</span>
                        <span className="block text-xs text-slate-500">{subtitle(u)}</span>
                      </span>
                      {!u.isActive && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">inactive</span>}
                    </LoginButton>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-500">
        Prototype auth: a signed, httpOnly session cookie. Production would use college SSO or Supabase Auth.
      </p>
    </main>
  );
}
