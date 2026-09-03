/**
 * Phase 8 standing check — the Publisher Platform against the LIVE project.
 * OWNER-004 gate (unverified -> submit blocked; verified -> passes), the
 * PB-08 verification lifecycle (submit -> PENDING -> resubmit conflict ->
 * Admin verify -> VERIFIED), suspended-Publisher rules (ADMIN-002), and the
 * verification document isolation (never readable by a Viewer or another
 * Publisher).
 *
 *   npm run verify:publisher
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
const tag = `pub_${Date.now()}`;
const ATTRS = `'{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb`;

try {
  const pId = await adminCreate(`${tag}_p@ex.com`, { role: "PUBLISHER", full_name: "Plat Pub", business_name: "Draft Co" });
  const p2Id = await adminCreate(`${tag}_p2@ex.com`, { role: "PUBLISHER", full_name: "Other Pub", business_name: "Other Co" });
  const vId = await adminCreate(`${tag}_v@ex.com`, { role: "VIEWER", full_name: "Plat Viewer" });
  const aId = await adminCreate(`${tag}_a@ex.com`, { role: "VIEWER", full_name: "Plat Admin" });
  created.push(pId, p2Id, vId, aId);
  await sql(`update profiles set role='ADMIN' where id='${aId}';`);

  const p = rest(await signIn(`${tag}_p@ex.com`));
  const p2 = rest(await signIn(`${tag}_p2@ex.com`));
  const viewer = rest(await signIn(`${tag}_v@ex.com`));
  const adm = rest(await signIn(`${tag}_a@ex.com`));

  // draft listing owned by the unverified publisher
  const hId = randomUUID();
  await sql(`insert into hoardings (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status)
             values ('${hId}','${pId}','UNIPOLE_BILLBOARD','${tag} draft', 50000,'MONTH',12.97,77.59,'MG Road','Bengaluru',${ATTRS},'DRAFT');`);

  // ---- 1. OWNER-004: unverified -> submit blocked -----------------------
  let r = await p("rpc/submit_hoarding_for_review", { method: "POST", body: JSON.stringify({ p_hoarding_id: hId }) });
  ok("unverified Publisher: submit_hoarding_for_review -> PUBLISHER_NOT_VERIFIED", seeable(r.body) === "PUBLISHER_NOT_VERIFIED", JSON.stringify(r.body).slice(0, 160));

  // a draft insert still works while unverified (draft-while-pending allowance)
  r = await p("hoardings", { method: "POST", body: JSON.stringify({ publisher_id: pId, type_code: "GANTRY", title: `${tag} draft2`, city: "Bengaluru" }) });
  ok("unverified Publisher can still create a DRAFT listing", r.status === 201, JSON.stringify(r.body).slice(0, 160));

  // ---- 2. PB-08 verification lifecycle -------------------------------
  r = await p("rpc/submit_publisher_verification", { method: "POST", body: JSON.stringify({ p_business_name: "Verified Signs Pvt Ltd", p_business_type: "Private limited company", p_document_path: `${pId}/verification-x.pdf` }) });
  ok("submit_publisher_verification -> PENDING", r.status === 200 && r.body?.verification_status === "PENDING", JSON.stringify(r.body).slice(0, 200));
  ok("submit updates business_name + business_type + submitted_at", r.body?.business_name === "Verified Signs Pvt Ltd" && r.body?.business_type === "Private limited company" && !!r.body?.verification_submitted_at);

  r = await p("rpc/submit_publisher_verification", { method: "POST", body: JSON.stringify({ p_business_name: "X", p_business_type: null, p_document_path: null }) });
  ok("re-submitting while PENDING -> PUBLISHER_VERIFICATION_STATE_CONFLICT", seeable(r.body) === "PUBLISHER_VERIFICATION_STATE_CONFLICT", JSON.stringify(r.body).slice(0, 160));

  // Admin rejects -> Publisher can resubmit
  await adm("rpc/reject_publisher_verification", { method: "POST", body: JSON.stringify({ p_publisher_id: pId, p_reason: "Blurry document" }) });
  r = await p("rpc/submit_publisher_verification", { method: "POST", body: JSON.stringify({ p_business_name: "Verified Signs Pvt Ltd", p_business_type: "Private limited company", p_document_path: `${pId}/verification-y.pdf` }) });
  ok("after REJECTED, resubmit -> PENDING again", r.status === 200 && r.body?.verification_status === "PENDING", JSON.stringify(r.body).slice(0, 160));

  // Admin verifies -> OWNER-004 gate now passes (next gate is core-fields)
  await adm("rpc/verify_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pId }) });
  r = await p("rpc/submit_hoarding_for_review", { method: "POST", body: JSON.stringify({ p_hoarding_id: hId }) });
  ok("verified Publisher: OWNER-004 passes, next gate is HOARDING_MISSING_MEDIA", seeable(r.body) === "HOARDING_MISSING_MEDIA", JSON.stringify(r.body).slice(0, 160));

  // ---- 3. suspended Publisher (ADMIN-002) ---------------------------
  await adm("rpc/suspend_publisher", { method: "POST", body: JSON.stringify({ p_publisher_id: pId, p_reason: "Test suspension" }) });
  r = await p("rpc/submit_hoarding_for_review", { method: "POST", body: JSON.stringify({ p_hoarding_id: hId }) });
  ok("suspended + verified Publisher: submit -> PUBLISHER_SUSPENDED", seeable(r.body) === "PUBLISHER_SUSPENDED", JSON.stringify(r.body).slice(0, 160));
  r = await p("rpc/submit_publisher_verification", { method: "POST", body: JSON.stringify({ p_business_name: "X", p_business_type: null, p_document_path: null }) });
  ok("suspended Publisher: submit_publisher_verification -> PUBLISHER_SUSPENDED", seeable(r.body) === "PUBLISHER_SUSPENDED", JSON.stringify(r.body).slice(0, 160));

  // an existing CONFIRMED request can still be completed while suspended
  const reqId = randomUUID();
  await sql(`update hoardings set approval_status='APPROVED', approved_at=now() where id='${hId}';
             insert into requests (id, hoarding_id, viewer_id, publisher_id, start_date, end_date, status, confirmed_at)
             values ('${reqId}','${hId}','${vId}','${pId}', current_date - 2, current_date + 3, 'CONFIRMED', now());`);
  r = await p("rpc/mark_request_completed", { method: "POST", body: JSON.stringify({ p_request_id: reqId }) });
  ok("suspended Publisher can still COMPLETE an existing Confirmed request (ADMIN-002)", r.status === 200 && r.body?.status === "COMPLETED", JSON.stringify(r.body).slice(0, 160));
  await sql(`update publisher_profiles set suspended=false, suspended_at=null where id='${pId}';`);

  // ---- 4. verification document isolation -------------------------
  await sql(`update publisher_profiles set verification_document_path='${pId}/secret.pdf' where id='${pId}';`);
  r = await viewer(`publisher_profiles?id=eq.${pId}&select=verification_document_path`);
  ok("a Viewer cannot read another Publisher's verification row at all", Array.isArray(r.body) && r.body.length === 0, JSON.stringify(r.body).slice(0, 160));
  r = await p2(`publisher_profiles?id=eq.${pId}&select=verification_document_path`);
  ok("another Publisher cannot read the verification row", Array.isArray(r.body) && r.body.length === 0, JSON.stringify(r.body).slice(0, 160));
  r = await p2("rpc/get_verification_document_path", { method: "POST", body: JSON.stringify({ p_publisher_id: pId }) });
  ok("get_verification_document_path by a non-owner -> FORBIDDEN_NOT_OWNER", seeable(r.body) === "FORBIDDEN_NOT_OWNER", JSON.stringify(r.body).slice(0, 160));
  r = await adm("rpc/get_verification_document_path", { method: "POST", body: JSON.stringify({ p_publisher_id: pId }) });
  ok("get_verification_document_path by an Admin -> returns the path", r.status === 200 && String(r.body).includes("secret.pdf"), JSON.stringify(r.body).slice(0, 160));
  {
    const vJwt = await signIn(`${tag}_v@ex.com`);
    const sr = await fetch(`${SUPA}/storage/v1/object/list/publisher-private`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${vJwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 100 }),
    });
    let sb;
    try { sb = await sr.json(); } catch { sb = null; }
    const noObjects = sr.status >= 400 || (Array.isArray(sb) && sb.length === 0);
    ok("publisher-private bucket exposes nothing to a Viewer (no storage policy)", noObjects, `${sr.status} ${JSON.stringify(sb).slice(0, 120)}`);
  }

  // ---- 5. PENDING behaves like UNVERIFIED for search visibility ----
  await sql(`update publisher_profiles set verification_status='PENDING' where id='${pId}';`);
  r = await sql(`select publisher_is_verified from public_hoarding_listings where id='${hId}'`);
  ok("a PENDING publisher's listing shows publisher_is_verified = false", r.length === 0 || r[0].publisher_is_verified === false, JSON.stringify(r));
} finally {
  try {
    await sql(`delete from requests where hoarding_id in (select id from hoardings where title like '${tag}%'); delete from hoardings where title like '${tag}%';`);
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
