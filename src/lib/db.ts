import postgres from "postgres";

type Sql = postgres.Sql<Record<string, unknown>>;
export type Tx = postgres.TransactionSql<Record<string, unknown>>;

function createClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    ssl: "require",
    max: 1,
    prepare: false, // the Supabase pooler doesn't keep prepared statements across sessions
    transform: postgres.camel,
    // Keep calendar dates as plain YYYY-MM-DD strings instead of UTC-midnight Date objects.
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  }) as unknown as Sql;
}

const g = globalThis as unknown as { __sql?: Sql };

// One client reused across hot reloads and warm serverless invocations.
function client(): Sql {
  return (g.__sql ??= createClient());
}

// Created lazily so importing this module (e.g. during `next build`) never needs the env var.
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args: unknown[]) => (client() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});

export async function closeDb(): Promise<void> {
  if (g.__sql) await g.__sql.end({ timeout: 5 });
  g.__sql = undefined;
}
