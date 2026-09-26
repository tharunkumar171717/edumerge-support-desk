// Browser-side helper for the /api routes. Never throws: callers branch on `ok`.

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; message: string; body: Record<string, unknown> | null };

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK", message: "Couldn't reach the server. Check your connection and try again.", body: null };
  }
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  return {
    ok: false,
    status: res.status,
    code: json?.error?.code ?? "ERROR",
    message: json?.error?.message ?? "Something went wrong. Please try again.",
    body: json,
  };
}

/** A form's fields as a plain object; unchecked checkboxes are simply absent, as in FormData. */
export function formJson(form: HTMLFormElement, submitter?: HTMLElement | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new FormData(form, submitter ?? undefined)) if (typeof v === "string") out[k] = v;
  return out;
}
