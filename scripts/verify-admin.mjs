/**
 * Phase 9 standing check — the Admin Platform against the LIVE project.
 *   ADMIN-001  no listing reaches Viewer search without approve_listing()
 *   ADMIN-002  suspend blocks new listings, never touches a Confirmed request
 *   ADMIN-003  a listing reject with no reason is refused
 *   ADMIN-004  suspend != delist; delist is independent; relist restores
 *   + two-Admin concurrency (FOR UPDATE), one admin_actions row per action,
 *     the suspend/unsuspend state guards, `requests` has no Admin RLS,
 *     and non-Admins are refused with ADMIN_ONLY.
 *
 *   npm run verify:admin
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
const tag = `adm_${Date.now()}`;
const ATTRS = `'{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb`;
const listedCount = (id) =>
  sql(`select count(*)::int n from public_hoarding_listings where id = '${id}'`).then((r) => r[0].n);
const actionCount = (type, hid, pid) =>
  sql(
    `select count(*)::int n from admin_actions where action_type = '${type}'` +
      (hid ? ` and target_hoarding_id = '${hid}'` : "") +
      (pid ? ` and target_publisher_id = '${pid}'` : ""),
  ).then((r) => r[0].n);

try {
  const pubId = await adminCreate(`${tag}_p@ex.com`, { role: "PUBLISHER", full_name: "Adm Pub", business_name: "Adm Signs" });
  const vId = await adminCreate(`${tag}_v@ex.com`, { role: "VIEWER", full_name: "Adm Viewer" });
  const aId = await adminCreate(`${tag}_a@ex.com`, { role: "VIEWER", full_name: "Ops A" });
  const bId = await adminCreate(`${tag}_b@ex.com`, { role: "VIEWER", full_name: "Ops B" });
  created.push(pubId, vId, aId, bId);
  await sql(`update profiles set role='ADMIN' where id in ('${aId}','${bId}');
             update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${pubId}';`);

  const adm = rest(await signIn(`${tag}_a@ex.com`));
  const admB = rest(await signIn(`${tag}_b@ex.com`));
  const viewer = rest(await signIn(`${tag}_v@ex.com`));

  // Two PENDING_REVIEW listings owned by the verified publisher.
  const h1 = randomUUID();
  const h2 = randomUUID();
  const h3 = randomUUID();
  await sql(`insert into hoardings (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status)
             values
             ('${h1}','${pubId}','UNIPOLE_BILLBOARD','${tag} one',   50000,'MONTH',12.97,77.59,'MG Road','Bengaluru',${ATTRS},'PENDING_REVIEW'),
             ('${h2}','${pubId}','UNIPOLE_BILLBOARD','${tag} two',   60000,'MONTH',12.98,77.60,'Indiranagar','Bengaluru',${ATTRS},'PENDING_REVIEW'),
             ('${h3}','${pubId}','UNIPOLE_BILLBOARD','${tag} three', 70000,'MONTH',12.99,77.61,'Koramangala','Bengaluru',${ATTRS},'PENDING_REVIEW');`);

  // ---- non-Admin is refused ---------------------------------------------
  let r = await viewer("rpc/approve_listing", { method: "POST", body: JSON.stringify({ p_hoarding_id: h1 }) });
  ok("VIEWER -> approve_listing -> ADMIN_ONLY", seeable(r.body) === "ADMIN_ONLY", JSON.stringify(r.body).slice(0, 160));
  r = await viewer("rpc/admin_dashboard_summary", { method: "POST", body: "{}" });
  ok("VIEWER -> admin_dashboard_summary -> ADMIN_ONLY", seeable(r.body) === "ADMIN_ONLY", JSON.stringify(r.body).slice(0, 160));

  // ---- ADMIN-001: not visible until approved ---------------------------
  ok("PENDING_REVIEW listing is NOT in public_hoarding_listings", (await listedCount(h1)) === 0);
  r = await adm("rpc/approve_listing", { method: "POST", body: JSON.stringify({ p_hoarding_id: h1 }) });
  ok("approve_listing -> APPROVED", r.status === 200 && (Array.isArray(r.body) ? r.body[0] : r.body)?.approval_status === "APPROVED", JSON.stringify(r.body).slice(0, 160));
  ok("ADMIN-001: approved listing IS now in public_hoarding_listings", (await listedCount(h1)) === 1);
  ok("approve wrote exactly one LISTING_APPROVED admin_actions row", (await actionCount("LISTING_APPROVED", h1)) === 1);

  // ---- ADMIN-003: reject needs a reason -------------------------------
  r = await adm("rpc/reject_listing", { method: "POST", body: JSON.stringify({ p_hoarding_id: h2, p_reason: "   " }) });
  ok("ADMIN-003: reject_listing with a blank reason -> refused", r.status >= 400 && seeable(r.body) === "VALIDATION_ERROR", JSON.stringify(r.body).slice(0, 160));
  r = await adm("rpc/reject_listing", { method: "POST", body: JSON.stringify({ p_hoarding_id: h2, p_reason: "Photos too dark to verify the site" }) });
  ok("reject_listing with a reason -> REJECTED", (Array.isArray(r.body) ? r.body[0] : r.body)?.approval_status === "REJECTED", JSON.stringify(r.body).slice(0, 160));
  ok("reject wrote exactly one LISTING_REJECTED admin_actions row", (await actionCount("LISTING_REJECTED", h2)) === 1);

  // ---- two Admins on one queue item ---------------------------------
  const [ra, rb] = await Promise.all([
    adm("rpc/approve_listing", { method: "POST", body: JSON.stringify({ p_hoarding_id: h3 }) }),
    admB("rpc/approve_listing", { method: "POST", body: JSON.stringify({ p_hoarding_id: h3 }) }),
  ]);
  const codes = [ra, rb].map((x) => (x.status === 200 ? "OK" : seeable(x.body)));
  ok(
    "two Admins approve the same listing -> exactly one OK, other HOARDING_INVALID_STATE",
    codes.filter((c) => c === "OK").length === 1 && codes.includes("HOARDING_INVALID_STATE"),
    JSON.stringify(codes),
  );
  ok("...and only one LISTING_APPROVED row was written", (await actionCount("LISTING_APPROVED", h3)) === 1);

  // ---- ADMIN-004: delist is independent, reversible ----------------
  r = await adm("rpc/delist_hoarding", { method: "POST", body: JSON.stringify({ p_hoarding_id: h1, p_reason: "Reported as removed" }) });
  ok("delist_hoarding -> is_delisted, approval_status unchanged", (Array.isArray(r.body) ? r.body[0] : r.body)?.is_delisted === true && (Array.isArray(r.body) ? r.body[0] : r.body)?.approval_status === "APPROVED", JSON.stringify(r.body).slice(0, 160));
  ok("delisted listing leaves public_hoarding_listings", (await listedCount(h1)) === 0);
  r = await adm("rpc/delist_hoarding", { method: "POST", body: JSON.stringify({ p_hoarding_id: h1 }) });
  ok("re-delist -> HOARDING_ALREADY_DELISTED", seeable(r.body) === "HOARDING_ALREADY_DELISTED", JSON.stringify(r.body).slice(0, 160));
  r = await adm("rpc/relist_hoarding", { method: "POST", body: JSON.stringify({ p_hoarding_id: h1 }) });
  ok("relist_hoarding -> visible again, no re-approval", r.status === 200 && (await listedCount(h1)) === 1, JSON.stringify(r.body).slice(0, 160));

  // ---- ADMIN-002: suspension --------------------------------------
  // a CONFIRMED request on the publisher's now-approved listing
  const reqId = randomUUID();
  await sql(`insert into requests (id, hoarding_id, viewer_id, publisher_id, start_date, end_date, status, confirmed_at)
             values ('${reqId}','${h1}','${vId}','${pubId}', current_date - 2, current_date + 5, 'CONFIRMED', now());`);
  r = await adm("rpc/suspend_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pubId, p_reason: "Test" }) });
  ok("suspend_publisher -> suspended", (Array.isArray(r.body) ? r.body[0] : r.body)?.suspended === true, JSON.stringify(r.body).slice(0, 160));
  const chk = await sql(`select status from requests where id='${reqId}'`);
  ok("ADMIN-002: the CONFIRMED request is untouched by suspension", chk[0].status === "CONFIRMED");
  ok("ADMIN-004: suspension does NOT delist the publisher's approved listing", (await listedCount(h1)) === 1);
  ok(
    "ADMIN-004: suspension does not set is_delisted on any of the publisher's hoardings",
    (await sql(`select count(*)::int n from hoardings where publisher_id='${pubId}' and is_delisted`))[0].n === 0,
  );
  r = await adm("rpc/suspend_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pubId }) });
  ok("double suspend -> PUBLISHER_VERIFICATION_STATE_CONFLICT", seeable(r.body) === "PUBLISHER_VERIFICATION_STATE_CONFLICT", JSON.stringify(r.body).slice(0, 160));

  const pub = rest(await signIn(`${tag}_p@ex.com`));
  r = await pub("rpc/submit_hoarding_for_review", { method: "POST", body: JSON.stringify({ p_hoarding_id: h2 }) });
  ok("suspended publisher: submit_hoarding_for_review -> PUBLISHER_SUSPENDED", seeable(r.body) === "PUBLISHER_SUSPENDED", JSON.stringify(r.body).slice(0, 160));
  r = await pub("rpc/mark_request_completed", { method: "POST", body: JSON.stringify({ p_request_id: reqId }) });
  ok("suspended publisher can still COMPLETE the existing Confirmed request", r.status === 200 && (Array.isArray(r.body) ? r.body[0] : r.body)?.status === "COMPLETED", JSON.stringify(r.body).slice(0, 160));

  r = await adm("rpc/unsuspend_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pubId }) });
  ok("unsuspend_publisher -> not suspended", (Array.isArray(r.body) ? r.body[0] : r.body)?.suspended === false, JSON.stringify(r.body).slice(0, 160));
  r = await adm("rpc/unsuspend_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pubId }) });
  ok("re-unsuspend -> PUBLISHER_VERIFICATION_STATE_CONFLICT", seeable(r.body) === "PUBLISHER_VERIFICATION_STATE_CONFLICT", JSON.stringify(r.body).slice(0, 160));
  ok("suspend/unsuspend each wrote one admin_actions row", (await actionCount("PUBLISHER_SUSPENDED", null, pubId)) === 1 && (await actionCount("PUBLISHER_UNSUSPENDED", null, pubId)) === 1);

  // ---- verification decisions write audit rows -------------------
  await sql(`update publisher_profiles set verification_status='PENDING', verification_submitted_at=now() where id='${pubId}';`);
  await adm("rpc/reject_publisher_verification", { method: "POST", body: JSON.stringify({ p_publisher_id: pubId, p_reason: "Doc unclear" }) });
  ok("reject_publisher_verification wrote a PUBLISHER_VERIFICATION_REJECTED row", (await actionCount("PUBLISHER_VERIFICATION_REJECTED", null, pubId)) === 1);
  await adm("rpc/verify_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pubId }) });
  ok("verify_publisher wrote a PUBLISHER_VERIFIED row", (await actionCount("PUBLISHER_VERIFIED", null, pubId)) === 1);

  // ---- Admin has NO request browser (D10) ----------------------
  r = await adm("requests?select=id");
  ok(
    "an Admin querying `requests` sees zero rows (no is_admin() SELECT policy)",
    Array.isArray(r.body) && r.body.length === 0,
    JSON.stringify(r.body).slice(0, 160),
  );

  // ---- dashboard aggregate ----------------------------------
  r = await adm("rpc/admin_dashboard_summary", { method: "POST", body: "{}" });
  const row = Array.isArray(r.body) ? r.body[0] : r.body;
  ok(
    "admin_dashboard_summary returns the AD-01 metric columns",
    r.status === 200 &&
      row &&
      "pending_verifications" in row &&
      "live_campaigns" in row &&
      "active_publishers" in row &&
      Number(row.total_listings) >= 3,
    JSON.stringify(row).slice(0, 200),
  );
} finally {
  try {
    await sql(`delete from requests where hoarding_id in (select id from hoardings where title like '${tag}%');
               delete from admin_actions where target_hoarding_id in (select id from hoardings where title like '${tag}%')
                 or target_publisher_id in (select id from profiles where email like '${tag}%');
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
