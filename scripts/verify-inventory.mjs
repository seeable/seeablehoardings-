/**
 * Phase 5 standing check — the Inventory module against the LIVE project, via
 * direct PostgREST / RPC as each role's JWT (RLS + grants are the real
 * enforcement layer). Covers the submission gates, OWNER-003 edit freeze,
 * INVENTORY-003 visibility, CONTENT-001, the grant tightening, and the
 * create -> submit -> approve -> visible loop.
 *
 *   npm run verify:inventory
 *
 * Creates throwaway users + rows and cleans them up at the end.
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
const rpc = (rester) => (fn, args) =>
  rester(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
const seeableCode = (body) =>
  (JSON.stringify(body).match(/SEEABLE_CODE=([A-Z_]+)/) || [])[1] ?? null;
const one = (body) => (Array.isArray(body) ? body[0] : body);

const created = [];
let hId;
try {
  const stamp = Date.now();
  const pubId = await adminCreate(`inv_pub_${stamp}@ex.com`, {
    role: "PUBLISHER",
    full_name: "Inv Pub",
    business_name: "Inv Media",
  });
  const viewerId = await adminCreate(`inv_vw_${stamp}@ex.com`, {
    role: "VIEWER",
    full_name: "Inv Viewer",
  });
  const adminId = await adminCreate(`inv_ad_${stamp}@ex.com`, {
    role: "VIEWER",
    full_name: "Inv Admin",
  });
  created.push(pubId, viewerId, adminId);
  await sql(`update profiles set role='ADMIN' where id='${adminId}';`);

  const pub = rest(await signIn(`inv_pub_${stamp}@ex.com`));
  const viewer = rest(await signIn(`inv_vw_${stamp}@ex.com`));
  const admin = rest(await signIn(`inv_ad_${stamp}@ex.com`));
  const pubRpc = rpc(pub);
  const adminRpc = rpc(admin);

  // 1. create a draft
  let r = await pub("hoardings", {
    method: "POST",
    body: JSON.stringify({ publisher_id: pubId, type_code: "UNIPOLE_BILLBOARD", title: "Verify Unipole" }),
  });
  hId = Array.isArray(r.body) ? r.body[0]?.id : null;
  ok("create -> DRAFT", r.status === 201 && r.body[0]?.approval_status === "DRAFT", JSON.stringify(r.body));

  // 2. grant tightening — a client cannot PATCH approval_status
  r = await pub(`hoardings?id=eq.${hId}`, {
    method: "PATCH",
    body: JSON.stringify({ approval_status: "APPROVED" }),
  });
  ok("PATCH approval_status refused (column grant)", r.status === 403 || r.status === 401, `${r.status} ${JSON.stringify(r.body)}`);

  // 3. client cannot INSERT hoarding_media
  r = await pub("hoarding_media", {
    method: "POST",
    body: JSON.stringify({ hoarding_id: hId, storage_path: "x", processing_status: "WATERMARKED" }),
  });
  ok("hoarding_media client INSERT refused", r.status === 401 || r.status === 403, `${r.status} ${JSON.stringify(r.body)}`);

  // 4. submit unverified -> PUBLISHER_NOT_VERIFIED
  r = await pubRpc("submit_hoarding_for_review", { p_hoarding_id: hId });
  ok("submit unverified -> PUBLISHER_NOT_VERIFIED", seeableCode(r.body) === "PUBLISHER_NOT_VERIFIED", JSON.stringify(r.body));

  await sql(`update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${pubId}';`);

  // 5. submit with no price/location -> HOARDING_MISSING_CORE_FIELDS
  r = await pubRpc("submit_hoarding_for_review", { p_hoarding_id: hId });
  ok("submit no core fields -> HOARDING_MISSING_CORE_FIELDS", seeableCode(r.body) === "HOARDING_MISSING_CORE_FIELDS", JSON.stringify(r.body));

  await pub(`hoardings?id=eq.${hId}`, {
    method: "PATCH",
    body: JSON.stringify({ price: 50000, latitude: 12.97, longitude: 77.59, locality: "Test" }),
  });

  // 6. incomplete attributes -> HOARDING_INCOMPLETE_ATTRIBUTES + missing keys
  r = await pubRpc("submit_hoarding_for_review", { p_hoarding_id: hId });
  ok("submit incomplete attrs -> HOARDING_INCOMPLETE_ATTRIBUTES", seeableCode(r.body) === "HOARDING_INCOMPLETE_ATTRIBUTES", JSON.stringify(r.body));
  const miss = await pubRpc("hoarding_missing_attribute_keys", { p_hoarding_id: hId });
  ok("missing_attribute_keys reported", Array.isArray(miss.body) && miss.body.length === 4, JSON.stringify(miss.body));

  await pub(`hoardings?id=eq.${hId}`, {
    method: "PATCH",
    body: JSON.stringify({
      attributes: { height_ft: 20, width_ft: 40, illumination: "backlit", facing_direction: "north" },
    }),
  });

  // 7. no media -> HOARDING_MISSING_MEDIA
  r = await pubRpc("submit_hoarding_for_review", { p_hoarding_id: hId });
  ok("submit no media -> HOARDING_MISSING_MEDIA", seeableCode(r.body) === "HOARDING_MISSING_MEDIA", JSON.stringify(r.body));

  // 8. un-watermarked media -> HOARDING_MEDIA_NOT_WATERMARKED
  const mId = randomUUID();
  await sql(`insert into hoarding_media (id, hoarding_id, storage_path, processing_status, is_primary)
             values ('${mId}','${hId}','${hId}/${mId}.jpg','PROCESSING', true);`);
  r = await pubRpc("submit_hoarding_for_review", { p_hoarding_id: hId });
  ok("un-watermarked media -> HOARDING_MEDIA_NOT_WATERMARKED", seeableCode(r.body) === "HOARDING_MEDIA_NOT_WATERMARKED", JSON.stringify(r.body));
  await sql(`update hoarding_media set processing_status='WATERMARKED', watermarked_at=now() where id='${mId}';`);

  // 9. submit succeeds -> PENDING_REVIEW
  r = await pubRpc("submit_hoarding_for_review", { p_hoarding_id: hId });
  ok("submit complete -> PENDING_REVIEW", r.status === 200 && one(r.body)?.approval_status === "PENDING_REVIEW", JSON.stringify(r.body));

  // 10. INVENTORY-003 — still invisible to the Viewer while PENDING_REVIEW
  r = await viewer(`public_hoarding_listings?id=eq.${hId}`);
  ok("PENDING_REVIEW invisible to Viewer (INVENTORY-003)", Array.isArray(r.body) && r.body.length === 0, JSON.stringify(r.body));

  // 11. admin approves
  r = await adminRpc("approve_listing", { p_hoarding_id: hId });
  ok("admin approve -> APPROVED", r.status === 200 && one(r.body)?.approval_status === "APPROVED", JSON.stringify(r.body));

  // 12. now visible to the Viewer, no contact/PII columns
  r = await viewer(`public_hoarding_detail?id=eq.${hId}`);
  const detail = Array.isArray(r.body) ? r.body[0] : null;
  ok("APPROVED visible to Viewer", !!detail, JSON.stringify(r.body));
  ok("disintermediation — no publisher contact in projection",
    detail && !("publisher_id" in detail) && !JSON.stringify(detail).match(/@ex\.com/),
    JSON.stringify(detail));
  ok("CONTENT-001 — media carries no original_storage_path",
    detail && !JSON.stringify(detail.media).includes("original"),
    JSON.stringify(detail?.media));

  // 13. Viewer creates a request -> OWNER-003 freezes core edits
  const today = new Date();
  const d1 = new Date(today.getTime() + 40 * 864e5).toISOString().slice(0, 10);
  const d2 = new Date(today.getTime() + 50 * 864e5).toISOString().slice(0, 10);
  r = await viewer("requests", {
    method: "POST",
    body: JSON.stringify({ hoarding_id: hId, viewer_id: viewerId, start_date: d1, end_date: d2 }),
  });
  const reqId = Array.isArray(r.body) ? r.body[0]?.id : null;
  ok("Viewer creates request", r.status === 201 && !!reqId, JSON.stringify(r.body));

  r = await pub(`hoardings?id=eq.${hId}`, { method: "PATCH", body: JSON.stringify({ price: 60000 }) });
  ok("core edit with REQUESTED -> HOARDING_EDIT_FROZEN", seeableCode(r.body) === "HOARDING_EDIT_FROZEN", `${r.status} ${JSON.stringify(r.body)}`);

  r = await pub(`hoardings?id=eq.${hId}`, { method: "PATCH", body: JSON.stringify({ description: "note" }) });
  ok("non-core edit still allowed while frozen", r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);

  // 14. delete with request history -> HOARDING_HAS_REQUEST_HISTORY
  r = await pubRpc("delete_hoarding", { p_hoarding_id: hId });
  ok("delete with history -> HOARDING_HAS_REQUEST_HISTORY", seeableCode(r.body) === "HOARDING_HAS_REQUEST_HISTORY", JSON.stringify(r.body));

  // 15. availability composition — confirm the request, then those dates read unavailable
  r = await pubRpc("confirm_request", { p_request_id: reqId });
  ok("publisher confirms request", r.status === 200, JSON.stringify(r.body));
  r = await pubRpc("is_hoarding_available", { p_hoarding_id: hId, p_start_date: d1, p_end_date: d2 });
  ok("confirmed dates read unavailable", r.body === false, JSON.stringify(r.body));

  const b1 = new Date(today.getTime() + 5 * 864e5).toISOString().slice(0, 10);
  const b2 = new Date(today.getTime() + 8 * 864e5).toISOString().slice(0, 10);
  await pub("hoarding_availability_blocks", {
    method: "POST",
    body: JSON.stringify({ hoarding_id: hId, start_date: b1, end_date: b2, reason: "maintenance" }),
  });
  r = await pubRpc("is_hoarding_available", { p_hoarding_id: hId, p_start_date: b1, p_end_date: b2 });
  ok("publisher-blocked dates read unavailable", r.body === false, JSON.stringify(r.body));
  r = await pubRpc("is_hoarding_available", {
    p_hoarding_id: hId,
    p_start_date: new Date(today.getTime() + 90 * 864e5).toISOString().slice(0, 10),
    p_end_date: new Date(today.getTime() + 95 * 864e5).toISOString().slice(0, 10),
  });
  ok("free dates read available", r.body === true, JSON.stringify(r.body));
} finally {
  // cleanup — requests -> media/blocks -> hoardings -> users (RESTRICT FK order)
  try {
    if (hId) {
      await sql(`delete from requests where hoarding_id='${hId}';`);
      await sql(`delete from hoardings where id='${hId}';`);
    }
    for (const id of created) {
      await fetch(`${SUPA}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SR, Authorization: `Bearer ${SR}` },
      });
    }
  } catch (e) {
    console.error("cleanup:", e.message);
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
