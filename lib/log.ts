/**
 * PII-safe structured request logger — api-specification.md §35.
 *
 * Allow-list, not deny-list (§35.3): the only fields that reach a log line are
 * the ones named in `RequestLog`. A caller cannot smuggle a token, email, phone,
 * password, signed URL, or request body through — there is no field for them.
 *
 * One line per request, emitted by the facade (`lib/api/facade.ts`) on the way
 * out. `console` is the sink; Cloudflare Workers ships stdout to the dashboard /
 * Logpush. Structured JSON in production, readable in dev.
 */

export interface RequestLog {
  request_id: string;
  method: string;
  /** Path TEMPLATE — `/api/v1/notifications/{id}`, never the concrete id (§35.2). */
  path: string;
  status: number;
  latency_ms: number;
  /** The §8 error code on failure — never the message. */
  error_code?: string;
  /** VIEWER | PUBLISHER | ADMIN, when authenticated. */
  role?: string;
  /** The user UUID — never name / email / phone (§35.3). */
  user_id?: string;
  /** A resource UUID where safe and relevant (hoarding/request/media id). */
  resource_id?: string;
  /** The PostgreSQL SQLSTATE on a DB error, for the §8.5 mapping. */
  sqlstate?: string;
  /** Correlates a retry with its original, when supplied. */
  idempotency_key?: string;
}

const ALLOWED: (keyof RequestLog)[] = [
  "request_id",
  "method",
  "path",
  "status",
  "latency_ms",
  "error_code",
  "role",
  "user_id",
  "resource_id",
  "sqlstate",
  "idempotency_key",
];

export function logRequest(entry: RequestLog): void {
  const line: Record<string, unknown> = { ts: nowIso() };
  for (const k of ALLOWED) {
    const v = entry[k];
    if (v !== undefined && v !== null && v !== "") line[k] = v;
  }

  if (process.env.NODE_ENV !== "production") {
    const { request_id, method, path, status, latency_ms, error_code } = entry;

    console.log(
      `${method} ${path} ${status} ${latency_ms}ms ${error_code ?? ""} ${request_id}`.trimEnd(),
    );
    return;
  }

  console.log(JSON.stringify(line));
}

// new Date() with no args is unavailable in some runtimes we target; Date.now()
// (ms since epoch) is always available and enough for a log timestamp.
function nowIso(): string {
  try {
    return new Date(Date.now()).toISOString();
  } catch {
    return String(Date.now());
  }
}
