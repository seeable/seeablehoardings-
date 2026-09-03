/**
 * Phase 6 standing check — Viewer discovery against the LIVE project.
 * INVENTORY-003 visibility, AND-combined filters, digital exclusion,
 * pagination meta, the disintermediation payload (RISK-16 — no Publisher
 * phone/email/name via the search RPC OR a direct public-view select), and the
 * paused-between-list-and-detail -> not-in-view case.
 *
 *   npm run verify:discovery
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
      headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(init.headers || {}) },
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

const created = [];
const tag = `disc_${Date.now()}`;
try {
  const pub = await adminCreate(`${tag}_pub@ex.com`, { role: "PUBLISHER", full_name: "Disc Pub", business_name: "Disc Media" });
  const viewer = await adminCreate(`${tag}_vw@ex.com`, { role: "VIEWER", full_name: "Disc Viewer" });
  created.push(pub, viewer);
  await sql(`update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${pub}';`);

  const ids = { A: randomUUID(), B: randomUUID(), C: randomUUID(), D: randomUUID(), E: randomUUID() };
  const attrs = `'{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb`;
  await sql(`
    insert into hoardings (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status, approved_at) values
      ('${ids.A}','${pub}','UNIPOLE_BILLBOARD','${tag} A Cheap', 40000,'MONTH', 12.9720, 77.5950, 'MG Road','Bengaluru', ${attrs}, 'APPROVED', now()),
      ('${ids.B}','${pub}','GANTRY','${tag} B Pricey', 200000,'MONTH', 12.9000, 77.6600, 'Silk Board','Bengaluru', ${attrs}, 'APPROVED', now()),
      ('${ids.C}','${pub}','WALL_WRAP','${tag} C Paused', 30000,'MONTH', 12.9750, 77.6000, 'Indiranagar','Bengaluru', ${attrs}, 'APPROVED', now()),
      ('${ids.D}','${pub}','UNIPOLE_BILLBOARD','${tag} D Draft', 25000,'MONTH', 12.97, 77.60, 'X','Bengaluru', ${attrs}, 'DRAFT', null),
      ('${ids.E}','${pub}','DIGITAL_BILLBOARD','${tag} E Digital', 90000,'MONTH', 12.97, 77.60, 'Y','Bengaluru', '{}'::jsonb, 'APPROVED', now());
    update hoardings set is_paused=true, paused_at=now() where id='${ids.C}';
  `);

  const v = rest(await signIn(`${tag}_vw@ex.com`));
  const rpc = (args) =>
    v("rpc/search_available_hoardings", { method: "POST", body: JSON.stringify(args) });
  const titles = (rows) => (rows.body || []).map((r) => r.title).filter((t) => t?.startsWith(tag)).sort();

  // 1. INVENTORY-003 — only APPROVED, not paused, not delisted; digital excluded
  let r = await rpc({ p_city: "Bengaluru", p_limit: 50 });
  ok("search returns only INVENTORY-003-visible rows", JSON.stringify(titles(r)) === JSON.stringify([`${tag} A Cheap`, `${tag} B Pricey`]), JSON.stringify(titles(r)));
  ok("paused listing excluded", !titles(r).includes(`${tag} C Paused`));
  ok("draft listing excluded", !titles(r).includes(`${tag} D Draft`));
  ok("digital type excluded (mvp-brd §5.1)", !titles(r).includes(`${tag} E Digital`));

  // 2. filters AND-combine
  r = await rpc({ p_city: "Bengaluru", p_type_code: "GANTRY", p_limit: 50 });
  ok("type filter narrows", JSON.stringify(titles(r)) === JSON.stringify([`${tag} B Pricey`]), JSON.stringify(titles(r)));
  r = await rpc({ p_city: "Bengaluru", p_max_price_monthly: 100000, p_limit: 50 });
  ok("budget filter narrows (monthly-normalised)", JSON.stringify(titles(r)) === JSON.stringify([`${tag} A Cheap`]), JSON.stringify(titles(r)));
  r = await rpc({ p_city: "Bengaluru", p_type_code: "GANTRY", p_max_price_monthly: 100000, p_limit: 50 });
  ok("type AND budget -> empty", titles(r).length === 0, JSON.stringify(titles(r)));

  // 3. geo filter + distance sort
  r = await rpc({ p_city: "Bengaluru", p_center_lat: 12.9720, p_center_lng: 77.5950, p_radius_km: 3, p_limit: 50 });
  ok("distance radius excludes the far gantry", JSON.stringify(titles(r)) === JSON.stringify([`${tag} A Cheap`]), JSON.stringify(titles(r)));
  r = await rpc({ p_city: "Bengaluru", p_center_lat: 12.9720, p_center_lng: 77.5950, p_radius_km: 30, p_limit: 50 });
  const geoRows = (r.body || []).filter((x) => x.title?.startsWith(tag));
  ok("distance_km populated + sorted ascending", geoRows.length === 2 && geoRows[0].distance_km <= geoRows[1].distance_km, JSON.stringify(geoRows.map((x) => [x.title, x.distance_km])));

  // 4. pagination meta via total_count window
  r = await rpc({ p_city: "Bengaluru", p_limit: 1, p_offset: 0 });
  ok("total_count reflects the full match set, not the page", (r.body || [])[0]?.total_count >= 2, JSON.stringify((r.body || [])[0]?.total_count));

  // 5. sort
  r = await rpc({ p_city: "Bengaluru", p_sort: "price_asc", p_limit: 50 });
  ok("price_asc sort", titles(r)[0] === `${tag} A Cheap`, JSON.stringify(titles(r)));

  // 6. DISINTERMEDIATION (RISK-16) — no PII in the search RPC payload
  r = await rpc({ p_city: "Bengaluru", p_limit: 50 });
  const searchJson = JSON.stringify(r.body);
  ok("search payload carries no phone/email/full_name/publisher_id",
    !searchJson.match(/@ex\.com/) && !searchJson.match(/publisher_id/) && !searchJson.match(/full_name/) && searchJson.includes("Disc Media"),
    searchJson.slice(0, 200));

  // 7. DISINTERMEDIATION — direct public-view select
  r = await v(`public_hoarding_detail?id=eq.${ids.A}&select=*`);
  const detailJson = JSON.stringify(r.body);
  ok("public_hoarding_detail direct select carries no PII",
    !detailJson.match(/@ex\.com/) && !detailJson.match(/"publisher_id"/) && !detailJson.match(/"phone"/) && detailJson.includes("Disc Media"),
    detailJson.slice(0, 200));
  ok("public_hoarding_detail exposes description + media (VW-03)",
    Array.isArray(r.body) && "description" in (r.body[0] || {}) && Array.isArray(r.body[0]?.media),
    Object.keys(r.body[0] || {}).join(","));

  // 8. a paused listing is absent from the detail view (VW-03 "no longer available")
  r = await v(`public_hoarding_detail?id=eq.${ids.C}`);
  ok("paused listing not in public_hoarding_detail", Array.isArray(r.body) && r.body.length === 0, JSON.stringify(r.body));
} finally {
  try {
    await sql(`delete from hoardings where title like '${tag}%';`);
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
