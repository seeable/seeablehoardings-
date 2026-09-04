/**
 * Thin-facade toolkit — IMPLEMENTATION-PLAN.md §Phase 3 · api-specification.md §6–§9.
 *
 * One `defineRoute({...})` builder does, in order (a failure short-circuits):
 *   1. adopt or generate `X-Request-Id`
 *   2. authenticate (401 AUTH_REQUIRED) and role-check (403 FORBIDDEN_ROLE)
 *   3. rate-limit (429 RATE_LIMITED + Retry-After)
 *   4. validate query (400 INVALID_FILTER / INVALID_PAGINATION) and body
 *      (422 VALIDATION_ERROR with the full `fields` map — §8.2)
 *   5. run the handler as the caller's own JWT (RLS applies)
 *   6. map any Postgres error via `pgErrorToApiError` (§8.5 / D7)
 *   7. wrap the `{success,data,meta,request_id}` envelope
 *   8. emit exactly one PII-safe log line (§35)
 *
 * NO business logic lives here — that is RLS policies + SECURITY DEFINER
 * functions (database-design.md §41). The facade adds shape and error ergonomics.
 */
import { NextResponse, type NextRequest } from "next/server";
import { type ZodType } from "zod";
import { ulid } from "ulid";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";
import { pgErrorToApiError, isPgError } from "@/lib/db/errors";
import { zodFields } from "@/lib/api/validation";
import { logRequest } from "@/lib/log";
import { consume, type RateLimit } from "@/lib/api/ratelimit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Tables"]["profiles"]["Row"]["role"];
type Supa = SupabaseClient<Database>;

const REQ_ID_RE = /^req_[0-9A-HJKMNP-TV-Z]{26}$/i;
const HAS_BODY = new Set(["POST", "PUT", "PATCH"]);
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface RouteContext<Q, B, P> {
  req: NextRequest;
  requestId: string;
  /** Supabase client bound to the caller's cookie session — RLS applies. */
  supabase: Supa;
  /** Non-null whenever `auth` is set. */
  user: SessionUser | null;
  query: Q;
  body: B;
  params: P;
  searchParams: URLSearchParams;
  /** Attach a resource UUID to this request's log line (UUIDs are not PII). */
  logResource: (id: string) => void;
}

export interface RouteResult<D> {
  data: D;
  meta?: Record<string, unknown>;
  status?: number;
}

export interface RouteConfig<Q, B, P, D> {
  /** Path TEMPLATE for logs — `/api/v1/notifications/{id}`, never a concrete id. */
  path: string;
  /** `true` = any signed-in user · a role / roles = only those · omit = public. */
  auth?: boolean | Role | Role[];
  query?: ZodType<Q>;
  body?: ZodType<B>;
  rateLimit?: RateLimit;
  /** Default 200 (or `RouteResult.status`). */
  status?: number;
  handler: (ctx: RouteContext<Q, B, P>) => Promise<D | RouteResult<D>>;
}

type NextRouteArgs<P> = [NextRequest, { params: Promise<P> } | undefined];

export function defineRoute<
  Q = undefined,
  B = undefined,
  P = Record<string, string>,
  D = unknown,
>(config: RouteConfig<Q, B, P, D>) {
  return async (...[req, context]: NextRouteArgs<P>): Promise<NextResponse> => {
    const started = Date.now();
    const supplied = req.headers.get("x-request-id");
    const requestId =
      supplied && REQ_ID_RE.test(supplied) ? supplied : `req_${ulid()}`;

    let resourceId: string | undefined;
    let user: SessionUser | null = null;
    let apiError: ApiError | null = null;
    let sqlstate: string | undefined;
    let status = config.status ?? 200;
    let payload: unknown;

    try {
      const params = ((await context?.params) ?? {}) as P;
      const searchParams = req.nextUrl.searchParams;

      // --- CSRF: same-origin check on every state-changing request --------
      // (api-specification.md §33 · Phase 11). Browsers attach `Origin` on
      // POST/PUT/PATCH/DELETE fetches even same-site; a cross-site page can
      // send the request but not forge this header. No cookie/token scheme
      // to bypass here — this alone is the mitigation, same as Next.js's own
      // Server Actions origin check.
      if (MUTATING.has(req.method)) assertSameOrigin(req);

      // --- 2. auth + role -------------------------------------------------
      if (config.auth) {
        user = await getSessionUser();
        if (!user) throw ApiError.of("AUTH_REQUIRED");
        const roles = roleList(config.auth);
        if (roles && !roles.includes(user.role)) {
          throw ApiError.of("FORBIDDEN_ROLE");
        }
      }

      // --- 3. rate limit ------------------------------------------------
      if (config.rateLimit) {
        consume(user?.id ?? clientIp(req), config.rateLimit);
      }

      // --- 4. validation ---------------------------------------------
      const query = config.query
        ? parseQuery(config.query, searchParams)
        : (undefined as Q);

      let body = undefined as B;
      if (config.body && HAS_BODY.has(req.method)) {
        body = await parseBody(config.body, req);
      }

      // --- 5. handler ----------------------------------------------
      const supabase = (await createClient()) as unknown as Supa;
      const result = await config.handler({
        req,
        requestId,
        supabase,
        user,
        query,
        body,
        params,
        searchParams,
        logResource: (id) => {
          resourceId = id;
        },
      });

      const norm = isRouteResult<D>(result) ? result : { data: result };
      status = norm.status ?? config.status ?? 200;
      payload = {
        success: true,
        data: norm.data,
        meta: norm.meta ?? {},
        request_id: requestId,
      };
    } catch (e) {
      apiError =
        e instanceof ApiError
          ? e
          : isPgError(e)
            ? ((sqlstate = e.code ?? undefined), pgErrorToApiError(e))
            : (logUnhandled(requestId, e), ApiError.of("INTERNAL_ERROR"));
      status = apiError.status;
      payload = {
        success: false,
        error: {
          code: apiError.code,
          message: apiError.message,
          details: apiError.details,
        },
        request_id: requestId,
      };
    }

    const res = NextResponse.json(payload, { status });
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("Cache-Control", "no-store");
    const retry = apiError?.details?.retry_after_seconds;
    if (typeof retry === "number")
      res.headers.set("Retry-After", String(retry));

    logRequest({
      request_id: requestId,
      method: req.method,
      path: config.path,
      status,
      latency_ms: Date.now() - started,
      error_code: apiError?.code,
      role: user?.role,
      user_id: user?.id,
      resource_id: resourceId,
      sqlstate,
    });

    return res;
  };
}

// --- helpers ------------------------------------------------------------

function roleList(auth: true | Role | Role[]): Role[] | null {
  if (auth === true) return null; // any authenticated
  return Array.isArray(auth) ? auth : [auth];
}

function isRouteResult<D>(x: unknown): x is RouteResult<D> {
  return typeof x === "object" && x !== null && "data" in x;
}

function parseQuery<Q>(schema: ZodType<Q>, sp: URLSearchParams): Q {
  const obj: Record<string, string> = {};
  for (const [k, v] of sp.entries()) obj[k] = v;
  const r = schema.safeParse(obj);
  if (r.success) return r.data;
  // An unknown query param is a rejected filter (§10.2), not a 422.
  if (r.error.issues.some((i) => i.code === "unrecognized_keys")) {
    throw ApiError.of("INVALID_FILTER", undefined, {
      fields: zodFields(r.error),
    });
  }
  throw ApiError.of("VALIDATION_ERROR", undefined, {
    fields: zodFields(r.error),
  });
}

async function parseBody<B>(schema: ZodType<B>, req: NextRequest): Promise<B> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.of("BAD_REQUEST", "The request body is not valid JSON.");
  }
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  throw ApiError.of("VALIDATION_ERROR", undefined, {
    fields: zodFields(r.error),
  });
}

/**
 * Reject a mutating request whose `Origin` (falling back to `Referer`, since
 * some browser/proxy paths omit `Origin` on same-origin requests) does not
 * match the request's own host. A same-site attacker page cannot set either
 * header to our origin; a legitimate same-origin fetch always carries one.
 */
function assertSameOrigin(req: NextRequest): void {
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) throw ApiError.of("FORBIDDEN_ORIGIN");

  let sourceOrigin: string;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    throw ApiError.of("FORBIDDEN_ORIGIN");
  }
  if (sourceOrigin !== req.nextUrl.origin) {
    throw ApiError.of("FORBIDDEN_ORIGIN");
  }
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function logUnhandled(requestId: string, e: unknown): void {
  console.error(`[${requestId}] unhandled route error`, e);
}
