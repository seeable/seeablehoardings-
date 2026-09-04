/**
 * Billboard inventory import — standing check — the billboard inventory import against the LIVE
 * project.
 *   BILLBOARD-001  every importable code (67 of 68 — SP-001 excluded, no
 *                  matching hoarding_types code) exists as exactly one hoarding
 *   BILLBOARD-002  no duplicate inventory codes (the unique index holds)
 *   BILLBOARD-003  every hoarding has at least one WATERMARKED media row
 *   BILLBOARD-004  a sample of public image URLs actually resolve (200, image/*)
 *   BILLBOARD-005  search_available_hoardings() returns exactly the
 *                  APPROVED, non-digital, in-scope set — not the DRAFT ones
 *   BILLBOARD-006  a non-Admin cannot approve/delist a billboard hoarding directly
 *
 *   npm run verify:billboards
 */
import { readFileSync, readdirSync } from "node:fs";

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
const REF = env.SUPABASE_PROJECT_REF;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!SUPA || !ANON || !REF || !TOKEN) {
  console.error("Need Supabase URL / anon / project-ref / access-token.");
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

const CODE_RE = /^SH-(BB|DB|BS|SP)-(\d{3})\.jpeg$/;
const EXPECTED_RANGES = { BB: [1, 63], DB: [1, 3], BS: [1, 1], SP: [1, 1] };
const importableCodes = [];
for (const [prefix, [lo, hi]] of Object.entries(EXPECTED_RANGES)) {
  if (prefix === "SP") continue; // excluded by design — no matching hoarding_types code
  for (let n = lo; n <= hi; n++) importableCodes.push(`SH-${prefix}-${String(n).padStart(3, "0")}`);
}

try {
  // ---- folder sanity (does the source still match what's imported?) ------
  const files = readdirSync("billboards").filter((f) => CODE_RE.test(f));
  ok(`BILLBOARD-000: billboards/ still has all 68 source files`, files.length === 68, `found ${files.length}`);

  // ---- BILLBOARD-001 / 002: presence + uniqueness -------------------------
  const rows = await sql(
    `select attributes->>'inventory_code' as code, approval_status, type_code
     from hoardings where attributes->>'inventory_code' like 'SH-%' order by code;`,
  );
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const missing = importableCodes.filter((c) => !byCode.has(c));
  ok(
    "BILLBOARD-001: all 67 importable codes exist as a hoarding",
    missing.length === 0,
    `missing: ${missing.join(", ")}`,
  );
  ok(
    "BILLBOARD-002: no duplicate inventory codes",
    rows.length === new Set(rows.map((r) => r.code)).size,
    `${rows.length} rows, ${new Set(rows.map((r) => r.code)).size} distinct`,
  );

  // ---- BILLBOARD-003: every hoarding has watermarked media ----------------
  const mediaGap = await sql(`
    select count(*)::int n from hoardings h
    where h.attributes->>'inventory_code' like 'SH-%'
      and not exists (
        select 1 from hoarding_media m
        where m.hoarding_id = h.id and m.processing_status = 'WATERMARKED'
      );
  `);
  ok("BILLBOARD-003: every imported hoarding has a WATERMARKED media row", mediaGap[0].n === 0, `${mediaGap[0].n} missing`);

  // ---- BILLBOARD-004: a sample of image URLs actually resolve ------------
  const sample = await sql(`
    select h.attributes->>'inventory_code' as code, m.storage_path
    from hoarding_media m join hoardings h on h.id = m.hoarding_id
    where h.attributes->>'inventory_code' like 'SH-%'
    order by random() limit 8;
  `);
  let broken = [];
  for (const row of sample) {
    const url = `${SUPA}/storage/v1/object/public/hoarding-public/${row.storage_path}`;
    const r = await fetch(url, { method: "HEAD" });
    if (r.status !== 200 || !(r.headers.get("content-type") ?? "").startsWith("image/")) {
      broken.push(`${row.code}: ${r.status}`);
    }
  }
  ok(`BILLBOARD-004: ${sample.length} sampled image URLs all resolve (200, image/*)`, broken.length === 0, broken.join("; "));

  // ---- BILLBOARD-005: search returns exactly the published set -----------
  const expectedPublished = importableCodes.filter((c) => {
    const r = byCode.get(c);
    return r && r.approval_status === "APPROVED";
  });
  const searchRes = await fetch(`${SUPA}/rest/v1/rpc/search_available_hoardings`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_type_code: null, p_city: null, p_max_price_monthly: null,
      p_center_lat: null, p_center_lng: null, p_radius_km: null,
      p_sort: "newest", p_limit: 200, p_offset: 0,
    }),
  }).then((r) => r.json());
  const searchIds = new Set(searchRes.map((r) => r.id));
  const publishedIds = new Set(
    (
      await sql(
        `select id from hoardings where attributes->>'inventory_code' in (${expectedPublished.map((c) => `'${c}'`).join(",")})`,
      )
    ).map((r) => r.id),
  );
  const searchTotal = Number(searchRes[0]?.total_count ?? searchRes.length);
  ok(
    "BILLBOARD-005: search_available_hoardings includes every published billboard",
    [...publishedIds].every((id) => searchIds.has(id)),
    `${[...publishedIds].filter((id) => !searchIds.has(id)).length} published rows missing from search`,
  );
  ok(
    "...and total_count matches the published-billboard count exactly (no DRAFT leakage)",
    searchTotal === publishedIds.size,
    `search total ${searchTotal} vs ${publishedIds.size} published`,
  );

  // ---- BILLBOARD-006: a non-Admin cannot moderate directly ----------------
  const hoardingId = (
    await sql(`select id from hoardings where attributes->>'inventory_code' = '${rows[0].code}' limit 1;`)
  )[0].id;
  const r = await fetch(`${SUPA}/rest/v1/rpc/approve_listing`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_hoarding_id: hoardingId }),
  });
  const body = await r.json();
  ok(
    "BILLBOARD-006: an anon caller cannot approve_listing() a billboard",
    r.status >= 400,
    JSON.stringify(body).slice(0, 160),
  );
} catch (e) {
  console.error("FATAL:", e);
  process.exit(1);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
