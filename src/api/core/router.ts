import type { NextRequest } from "next/server";
import type { User } from "@/lib/domain/types";
import { errorResponse, HttpError } from "./errors";

/** Per-request state passed down the middleware chain to the controller. */
export interface Context {
  req: NextRequest;
  params: Record<string, string>; // from the path pattern, e.g. /tickets/:id
  query: URLSearchParams;
  user: User | null; // set by the authenticate middleware
  body: unknown; // set by the validateBody middleware
}

export type Controller = (ctx: Context) => Promise<Response>;
export type Middleware = (ctx: Context, next: () => Promise<Response>) => Promise<Response>;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface Route {
  method: Method;
  path: string;
  regex: RegExp;
  keys: string[];
  middlewares: Middleware[];
  controller: Controller;
}

function compile(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = path.replace(/\/+$/, "").replace(/:(\w+)/g, (_, k: string) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${pattern || "/"}/?$`), keys };
}

/**
 * A small Express-style router: `router.get("/tickets/:id", authenticate, getTicket)`.
 * Middlewares run in order and each calls `next()`; the last function is the controller.
 */
export class Router {
  private routes: Route[] = [];

  private add(method: Method, path: string, handlers: [...Middleware[], Controller]) {
    const controller = handlers.at(-1) as Controller;
    const middlewares = handlers.slice(0, -1) as Middleware[];
    this.routes.push({ method, path, ...compile(path), middlewares, controller });
    return this;
  }

  get(path: string, ...h: [...Middleware[], Controller]) { return this.add("GET", path, h); }
  post(path: string, ...h: [...Middleware[], Controller]) { return this.add("POST", path, h); }
  put(path: string, ...h: [...Middleware[], Controller]) { return this.add("PUT", path, h); }
  patch(path: string, ...h: [...Middleware[], Controller]) { return this.add("PATCH", path, h); }
  delete(path: string, ...h: [...Middleware[], Controller]) { return this.add("DELETE", path, h); }

  /** Mount another router's routes under a prefix, e.g. `api.use("/tickets", ticketRoutes)`. */
  use(prefix: string, sub: Router) {
    for (const r of sub.routes) this.add(r.method, prefix + (r.path === "/" ? "" : r.path), [...r.middlewares, r.controller]);
    return this;
  }

  async handle(req: NextRequest, path: string): Promise<Response> {
    try {
      const candidates = this.routes.map((r) => ({ r, m: r.regex.exec(path) })).filter((x) => x.m);
      if (!candidates.length) throw new HttpError(404, "NOT_FOUND", `No API route for ${path}.`);
      const hit = candidates.find((x) => x.r.method === req.method);
      if (!hit) {
        const allow = [...new Set(candidates.map((x) => x.r.method))].join(", ");
        throw new HttpError(405, "METHOD_NOT_ALLOWED", `${req.method} is not supported here. Use ${allow}.`, { allow });
      }
      const params = Object.fromEntries(hit.r.keys.map((k, i) => [k, decodeURIComponent(hit.m![i + 1])]));
      const ctx: Context = { req, params, query: req.nextUrl.searchParams, user: null, body: undefined };
      const chain = [...hit.r.middlewares];
      const run = (i: number): Promise<Response> => (i < chain.length ? chain[i](ctx, () => run(i + 1)) : hit.r.controller(ctx));
      return await run(0);
    } catch (e) {
      return errorResponse(e);
    }
  }
}
