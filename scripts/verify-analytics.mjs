/**
 * Phase 10 standing check — Analytics + KPIs against the LIVE project.
 *   ANALYTICS-001  any signed-in (or anon) caller can insert an analytics_events row
 *   ANALYTICS-002  a Viewer cannot read analytics_events back (Admin-only SELECT)
 *   ANALYTICS-003  a non-Admin calling admin_kpis() is refused with ADMIN_ONLY
 *   ANALYTICS-004  admin_kpis() figures match independently-computed raw SQL
 *   ANALYTICS-005  notify_request_created() still writes both REQUEST_CREATED
 *                  rows in the same transaction as the request insert (Phase 1/7,
 *                  re-verified here per Phase 10's "confirm in-transaction writes")
 *
 *   npm run verify:analytics
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (!l || l.startsWith("#") || !l.includes("=")) continue;
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      if (env[k] === undefined) env[k] = l.slice(i + 1).trim();
    }
  } catch {
    /* optional */
  }
  return env;
}
const env = loadEnv();
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const REF = env.SUPABASE_PROJECT_REF;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!SUPA || !ANON || !SR || !REF || !TOKEN) {
  console.error("Need Supabase URL / anon / service-role / project-ref / access-token.");
  process.exit(1);
}

const results = [];
const ok = (n, pass, d = "") => {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${n}${pass ? "" : "   <<< " + d}`);
};
const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t}`);
  return t ? JSON.parse(t) : null;
};
const adminCreate = async (email, meta) => {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test-passw0rd!", email_confirm: true, user_metadata: meta }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`create ${email}: ${JSON.stringify(j)}`);
  return j.id;
};
const signIn = async (email) => {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test-passw0rd!" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`signin ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
};
const rest =
  (jwt) =>
  async (path, init = {}) => {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        Prefer: init.prefer ?? "return=representation",
        ...(init.headers || {}),
      },
    });
    const txt = await r.text();
    let body;
    try {
      body = JSON.parse(txt);
    } catch {
      body = txt;
    }
    return { status: r.status, body };
  };
const seeable = (body) => {
  const m = JSON.stringify(body ?? "").match(/SEEABLE_CODE=([A-Z0-9_]+)/);
  return m ? m[1] : null;
};

const created = [];
const tag = `an_${Date.now()}`;
const ATTRS = `'{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb`;

try {
  const aId = await adminCreate(`${tag}_a@ex.com`, { role: "VIEWER", full_name: "Ops A" });
  const vId = await adminCreate(`${tag}_v@ex.com`, { role: "VIEWER", full_name: "An Viewer" });
  const pubId = await adminCreate(`${tag}_p@ex.com`, { role: "PUBLISHER", full_name: "An Pub", business_name: "An Signs" });
  created.push(aId, vId, pubId);
  await sql(`update profiles set role='ADMIN' where id='${aId}';
             update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${pubId}';`);

  const adm = rest(await signIn(`${tag}_a@ex.com`));
  const viewer = rest(await signIn(`${tag}_v@ex.com`));

  // ---- ANALYTICS-001: any authenticated caller can insert -----------------
  // This table is write-only for non-Admins (insert: any · select: Admin-only),
  // so `Prefer: return=representation` — the default for every other verify
  // script's rest() calls — would itself fail RLS here: PostgREST's implicit
  // RETURNING re-selects the new row under the SELECT policy, which a Viewer
  // can never satisfy. `lib/analytics/client.ts` never calls `.select()`
  // (supabase-js then sends no explicit Prefer, i.e. PostgREST's real default
  // of `return=minimal`), which is exactly why the real client is unaffected —
  // this is a property of the table's RLS shape, verified here explicitly.
  let r = await viewer("analytics_events", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({ event_name: "HOARDING_VIEWED", properties: { tag } }),
  });
  ok("ANALYTICS-001: a Viewer can insert an analytics_events row", r.status === 201, JSON.stringify(r.body).slice(0, 160));

  // ---- ANALYTICS-002: a Viewer cannot read it back -------------------------
  r = await viewer(`analytics_events?properties->>tag=eq.${tag}`);
  ok(
    "ANALYTICS-002: a Viewer's SELECT on analytics_events returns zero rows (Admin-only)",
    r.status === 200 && Array.isArray(r.body) && r.body.length === 0,
    JSON.stringify(r.body).slice(0, 160),
  );
  r = await adm(`analytics_events?properties->>tag=eq.${tag}`);
  ok(
    "...but an Admin can read that same row",
    r.status === 200 && Array.isArray(r.body) && r.body.length === 1 && r.body[0].event_name === "HOARDING_VIEWED",
    JSON.stringify(r.body).slice(0, 160),
  );

  // ---- ANALYTICS-003: admin_kpis() is Admin-only ---------------------------
  r = await viewer("rpc/admin_kpis", { method: "POST", body: "{}" });
  ok("ANALYTICS-003: VIEWER -> admin_kpis -> ADMIN_ONLY", seeable(r.body) === "ADMIN_ONLY", JSON.stringify(r.body).slice(0, 160));

  // ---- seed data to exercise repeat-usage + response-time -----------------
  const h1 = randomUUID();
  const h2 = randomUUID();
  await sql(`insert into hoardings (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status)
             values
             ('${h1}','${pubId}','UNIPOLE_BILLBOARD','${tag} one',50000,'MONTH',12.97,77.59,'MG Road','Bengaluru',${ATTRS},'APPROVED'),
             ('${h2}','${pubId}','UNIPOLE_BILLBOARD','${tag} two',60000,'MONTH',12.98,77.60,'Indiranagar','Bengaluru',${ATTRS},'APPROVED');`);
  const req1 = randomUUID();
  const req2 = randomUUID();
  await sql(`insert into requests (id, hoarding_id, viewer_id, publisher_id, start_date, end_date, status, created_at, confirmed_at)
             values
             ('${req1}','${h1}','${vId}','${pubId}', current_date + 30, current_date + 37, 'CONFIRMED', now() - interval '9 hours', now()),
             ('${req2}','${h2}','${vId}','${pubId}', current_date + 60, current_date + 67, 'CONFIRMED', now() - interval '3 hours', now());`);

  // ---- ANALYTICS-004: admin_kpis() matches independently-computed SQL -----
  r = await adm("rpc/admin_kpis", { method: "POST", body: "{}" });
  const row = Array.isArray(r.body) ? r.body[0] : r.body;
  const [ref] = await sql(`
    select
      (select count(*) from publisher_profiles) as publishers_onboarded,
      (select count(*) from publisher_profiles where verification_status = 'VERIFIED') as publishers_verified,
      (select count(*) from hoardings where approval_status = 'APPROVED' and not is_paused and not is_delisted) as live_approved_listings,
      (select count(*) from profiles where role = 'VIEWER') as viewer_accounts,
      (select count(*) from requests) as requests_submitted,
      (select count(distinct viewer_id) from requests r2
         where (select count(*) from requests r3 where r3.viewer_id = r2.viewer_id) > 1) as repeat_viewers,
      (select count(distinct publisher_id) from hoardings h2
         where (select count(*) from hoardings h3 where h3.publisher_id = h2.publisher_id) > 1) as repeat_publishers
  `);
  ok(
    "ANALYTICS-004: publishers/listings/viewers/requests counts match an independent query",
    r.status === 200 &&
      Number(row.publishers_onboarded) === Number(ref.publishers_onboarded) &&
      Number(row.publishers_verified) === Number(ref.publishers_verified) &&
      Number(row.live_approved_listings) === Number(ref.live_approved_listings) &&
      Number(row.viewer_accounts) === Number(ref.viewer_accounts) &&
      Number(row.requests_submitted) === Number(ref.requests_submitted),
    JSON.stringify({ row, ref }).slice(0, 400),
  );
  ok(
    "...repeat_viewers / repeat_publishers match a correlated-subquery cross-check",
    Number(row.repeat_viewers) === Number(ref.repeat_viewers) &&
      Number(row.repeat_publishers) === Number(ref.repeat_publishers),
    JSON.stringify({ repeat_viewers: row.repeat_viewers, repeat_publishers: row.repeat_publishers, ref }).slice(0, 300),
  );
  ok(
    "...the two seeded requests made this Viewer/Publisher count as repeat usage",
    Number(row.repeat_viewers) >= 1 && Number(row.repeat_publishers) >= 1,
  );
  ok(
    "...median_publisher_response_hours is between the two seeded responses (3h, 9h)",
    Number(row.median_publisher_response_hours) >= 3 && Number(row.median_publisher_response_hours) <= 9,
    String(row.median_publisher_response_hours),
  );

  // ---- ANALYTICS-005: REQUEST_CREATED still fires two rows, in-transaction ----
  const h3 = randomUUID();
  await sql(`insert into hoardings (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status)
             values ('${h3}','${pubId}','UNIPOLE_BILLBOARD','${tag} three',70000,'MONTH',12.99,77.61,'Koramangala','Bengaluru',${ATTRS},'APPROVED');`);
  // Create the request directly through PostgREST (as the Viewer), the same
  // path POST /api/v1/requests uses, so the real BEFORE/AFTER INSERT triggers
  // run — not a raw SQL insert that would bypass them.
  r = await viewer("requests", {
    method: "POST",
    body: JSON.stringify({ hoarding_id: h3, viewer_id: vId, publisher_id: vId, start_date: "2027-01-10", end_date: "2027-01-17" }), // trigger overwrites publisher_id — matches the route
  });
  const newReqId = Array.isArray(r.body) ? r.body[0]?.id : r.body?.id;
  ok("request insert via PostgREST succeeded (trigger path)", r.status === 201 && !!newReqId, JSON.stringify(r.body).slice(0, 200));
  const notifRows = await sql(
    `select recipient_id, type from notifications where related_request_id = '${newReqId}' and type = 'REQUEST_CREATED' order by recipient_id`,
  );
  ok(
    "ANALYTICS-005: exactly 2 REQUEST_CREATED rows (viewer + publisher), written with the request",
    notifRows.length === 2 &&
      notifRows.some((n) => n.recipient_id === vId) &&
      notifRows.some((n) => n.recipient_id === pubId),
    JSON.stringify(notifRows),
  );
} finally {
  try {
    await sql(`delete from notifications where related_request_id in (select id from requests where hoarding_id in (select id from hoardings where title like '${tag}%'));
               delete from requests where hoarding_id in (select id from hoardings where title like '${tag}%');
               delete from analytics_events where properties->>'tag' = '${tag}';
               delete from hoardings where title like '${tag}%';`);
    for (const id of created) {
      await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
    }
  } catch (e) {
    console.error("cleanup:", e.message);
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
