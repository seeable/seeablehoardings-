/**
 * Phase 7 standing check — the Request Engine against the LIVE project, via
 * direct PostgREST / RPC as each role's JWT. The database (confirm_request and
 * friends, the EXCLUDE constraint, the VIEWER-002 partial unique index, the
 * BEFORE INSERT trigger, the expire/live jobs) is the enforcement layer; this
 * exercises it — including the concurrency correctness the plan says must not
 * be skipped (RISK-4).
 *
 *   npm run verify:requests
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

/** SEEABLE_CODE tag out of a PostgREST error body, or null. */
const seeable = (body) => {
  const blob = JSON.stringify(body ?? "");
  const m = blob.match(/SEEABLE_CODE=([A-Z0-9_]+)/);
  return m ? m[1] : null;
};

const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => iso(new Date(Date.now() + n * 86_400_000));

const created = [];
const tag = `req_${Date.now()}`;
const ATTRS = `'{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb`;

try {
  const pubId = await adminCreate(`${tag}_pub@ex.com`, { role: "PUBLISHER", full_name: "Req Pub", phone: "+919000000001", business_name: "Req Media" });
  const v1Id = await adminCreate(`${tag}_v1@ex.com`, { role: "VIEWER", full_name: "Viewer One", phone: "+919000000002" });
  const v2Id = await adminCreate(`${tag}_v2@ex.com`, { role: "VIEWER", full_name: "Viewer Two", phone: "+919000000003" });
  const admId = await adminCreate(`${tag}_adm@ex.com`, { role: "VIEWER", full_name: "Req Admin" });
  created.push(pubId, v1Id, v2Id, admId);
  await sql(`
    update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${pubId}';
    update profiles set role='ADMIN' where id='${admId}';
  `);

  const H = { main: randomUUID(), race: randomUUID(), sla: randomUUID(), dup: randomUUID() };
  await sql(`
    insert into hoardings (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status, approved_at) values
      ('${H.main}','${pubId}','UNIPOLE_BILLBOARD','${tag} main', 50000,'MONTH',12.97,77.59,'MG Road','Bengaluru',${ATTRS},'APPROVED',now()),
      ('${H.race}','${pubId}','GANTRY','${tag} race', 60000,'MONTH',12.90,77.66,'Silk Board','Bengaluru',${ATTRS},'APPROVED',now()),
      ('${H.sla}','${pubId}','WALL_WRAP','${tag} sla', 30000,'MONTH',12.98,77.60,'Indiranagar','Bengaluru',${ATTRS},'APPROVED',now()),
      ('${H.dup}','${pubId}','UNIPOLE_BILLBOARD','${tag} dup', 25000,'MONTH',12.95,77.70,'Marathahalli','Bengaluru',${ATTRS},'APPROVED',now());
  `);

  const pub = rest(await signIn(`${tag}_pub@ex.com`));
  const v1 = rest(await signIn(`${tag}_v1@ex.com`));
  const v2 = rest(await signIn(`${tag}_v2@ex.com`));
  const adm = rest(await signIn(`${tag}_adm@ex.com`));

  const submit = (v, viewerId, hoardingId, start, end, message) =>
    v("requests", {
      method: "POST",
      body: JSON.stringify({
        hoarding_id: hoardingId,
        viewer_id: viewerId,
        publisher_id: viewerId, // trigger overwrites — matches the route
        start_date: start,
        end_date: end,
        message: message ?? null,
      }),
    });
  const confirm = (client, id) =>
    client("rpc/confirm_request", { method: "POST", body: JSON.stringify({ p_request_id: id }) });
  const reject = (client, id, reason) =>
    client("rpc/reject_request", { method: "POST", body: JSON.stringify({ p_request_id: id, p_reason: reason ?? null }) });
  const complete = (client, id) =>
    client("rpc/mark_request_completed", { method: "POST", body: JSON.stringify({ p_request_id: id }) });
  const setAmount = (client, id, amount) =>
    client("rpc/set_request_amount_agreed", { method: "POST", body: JSON.stringify({ p_request_id: id, p_amount: amount }) });
  const statusOf = async (id) =>
    (await sql(`select status from requests where id='${id}'`))[0]?.status;

  // ---- 1. full lifecycle ------------------------------------------------
  let r = await submit(v1, v1Id, H.main, plusDays(10), plusDays(20), "Launch campaign");
  ok("create -> REQUESTED", r.status === 201 && r.body[0]?.status === "REQUESTED", JSON.stringify(r.body).slice(0, 200));
  const mainReq = r.body[0]?.id;
  ok("trigger denormalised the real publisher_id", r.body[0]?.publisher_id === pubId, r.body[0]?.publisher_id);
  ok("trigger set sla_deadline ~48h out", !!r.body[0]?.sla_deadline, r.body[0]?.sla_deadline);
  r = await confirm(pub, mainReq);
  ok("publisher ACCEPT -> CONFIRMED", r.status === 200 && r.body?.status === "CONFIRMED", JSON.stringify(r.body).slice(0, 200));
  await sql(`update requests set start_date='${plusDays(-2)}', end_date='${plusDays(5)}' where id='${mainReq}'`);
  r = await complete(pub, mainReq);
  ok("publisher COMPLETE (past start) -> COMPLETED", r.status === 200 && r.body?.status === "COMPLETED", JSON.stringify(r.body).slice(0, 200));

  // ---- 2. concurrency (RISK-4): two overlapping ACCEPTs, exactly one wins
  let raceWins = 0, raceConflicts = 0, raceOther = 0;
  for (let i = 0; i < 8; i++) {
    await sql(`delete from requests where hoarding_id='${H.race}'`);
    const a = (await submit(v1, v1Id, H.race, plusDays(5), plusDays(15))).body[0]?.id;
    const b = (await submit(v2, v2Id, H.race, plusDays(10), plusDays(20))).body[0]?.id;
    const [ra, rb] = await Promise.all([confirm(pub, a), confirm(pub, b)]);
    const wins = [ra, rb].filter((x) => x.status === 200 && x.body?.status === "CONFIRMED").length;
    const conflicts = [ra, rb].filter((x) => seeable(x.body) === "REQUEST_DATE_CONFLICT").length;
    raceWins += wins === 1 ? 1 : 0;
    raceConflicts += conflicts === 1 ? 1 : 0;
    if (wins !== 1 || conflicts !== 1) raceOther++;
    // the winner is CONFIRMED, the loser still REQUESTED
    const sa = await statusOf(a), sb = await statusOf(b);
    if ([sa, sb].sort().join() !== "CONFIRMED,REQUESTED") raceOther++;
  }
  ok("concurrent ACCEPT on overlapping requests: exactly one CONFIRMED, every round", raceWins === 8, `${raceWins}/8`);
  ok("the loser gets REQUEST_DATE_CONFLICT and stays REQUESTED", raceConflicts === 8 && raceOther === 0, `conflicts ${raceConflicts}/8, anomalies ${raceOther}`);

  // ---- 3. two viewers submit overlapping -> both REQUESTED -------------
  await sql(`delete from requests where hoarding_id='${H.race}'`);
  const oa = (await submit(v1, v1Id, H.race, plusDays(5), plusDays(15))).body[0]?.id;
  const obb = (await submit(v2, v2Id, H.race, plusDays(10), plusDays(20))).body[0]?.id;
  ok("two Viewers, overlapping dates -> both REQUESTED", (await statusOf(oa)) === "REQUESTED" && (await statusOf(obb)) === "REQUESTED");

  // ---- 4. creation against CONFIRMED dates is blocked -----------------
  await confirm(pub, oa);
  r = await submit(v2, v2Id, H.race, plusDays(8), plusDays(12));
  ok("submit overlapping a CONFIRMED range -> REQUEST_DATE_CONFLICT", seeable(r.body) === "REQUEST_DATE_CONFLICT", JSON.stringify(r.body).slice(0, 200));

  // ---- 5. VIEWER-002 duplicate pending ------------------------------
  r = await submit(v1, v1Id, H.dup, plusDays(5), plusDays(10));
  const dupFirst = r.body[0]?.id;
  r = await submit(v1, v1Id, H.dup, plusDays(20), plusDays(25));
  ok("second REQUESTED on the same listing -> REQUEST_DUPLICATE_PENDING", seeable(r.body) === "REQUEST_DUPLICATE_PENDING" || r.status === 409, JSON.stringify(r.body).slice(0, 200));
  await reject(pub, dupFirst);
  r = await submit(v1, v1Id, H.dup, plusDays(20), plusDays(25));
  ok("after the first is rejected, a fresh request succeeds", r.status === 201 && r.body[0]?.status === "REQUESTED", JSON.stringify(r.body).slice(0, 200));

  // ---- 6. REQUEST-002 — rejected dates read available immediately ----
  r = await v1("rpc/is_hoarding_available", {
    method: "POST",
    body: JSON.stringify({ p_hoarding_id: H.dup, p_start_date: plusDays(5), p_end_date: plusDays(10) }),
  });
  ok("rejected request's dates are available again immediately (REQUEST-002)", r.body === true, JSON.stringify(r.body));

  // ---- 7. REQUEST-003 — COMPLETE before start_date -------------------
  await sql(`delete from requests where hoarding_id='${H.sla}'`);
  const early = (await submit(v1, v1Id, H.sla, plusDays(10), plusDays(20))).body[0]?.id;
  await confirm(pub, early);
  r = await complete(pub, early);
  ok("COMPLETE before start_date -> REQUEST_COMPLETE_TOO_EARLY (REQUEST-003)", seeable(r.body) === "REQUEST_COMPLETE_TOO_EARLY", JSON.stringify(r.body).slice(0, 200));

  // ---- 8. transition guards ----------------------------------------
  r = await confirm(pub, early); // already CONFIRMED
  ok("ACCEPT on a non-REQUESTED request -> REQUEST_STATE_CONFLICT", seeable(r.body) === "REQUEST_STATE_CONFLICT", JSON.stringify(r.body).slice(0, 200));
  r = await reject(pub, early);
  ok("REJECT on a CONFIRMED request -> REQUEST_STATE_CONFLICT", seeable(r.body) === "REQUEST_STATE_CONFLICT", JSON.stringify(r.body).slice(0, 200));

  // ---- 9. amount_agreed gating ------------------------------------
  await sql(`delete from requests where hoarding_id='${H.main}'`);
  const amtReq = (await submit(v1, v1Id, H.main, plusDays(30), plusDays(40))).body[0]?.id;
  r = await setAmount(pub, amtReq, 45000);
  ok("SET_AMOUNT_AGREED while REQUESTED -> REQUEST_AMOUNT_NOT_SETTABLE", seeable(r.body) === "REQUEST_AMOUNT_NOT_SETTABLE", JSON.stringify(r.body).slice(0, 200));
  await confirm(pub, amtReq);
  r = await setAmount(v1, amtReq, 45000);
  ok("SET_AMOUNT_AGREED by a non-owner -> FORBIDDEN_NOT_OWNER", seeable(r.body) === "FORBIDDEN_NOT_OWNER", JSON.stringify(r.body).slice(0, 200));
  r = await setAmount(pub, amtReq, 45000);
  ok("SET_AMOUNT_AGREED by the owner, post-confirmation -> recorded", r.status === 200 && Number(r.body?.amount_agreed) === 45000, JSON.stringify(r.body).slice(0, 200));

  // ---- 10. Admin COMPLETE works, but the request is not Admin-readable
  await sql(`update requests set start_date='${plusDays(-2)}' where id='${amtReq}'`);
  r = await adm("rpc/mark_request_completed", { method: "POST", body: JSON.stringify({ p_request_id: amtReq }) });
  ok("Admin can mark a request COMPLETED (the one exception)", r.status === 200 && r.body?.status === "COMPLETED", JSON.stringify(r.body).slice(0, 200));
  r = await adm(`requests?id=eq.${amtReq}&select=id`);
  ok("Admin still cannot SELECT the request (no admin RLS clause — D10)", Array.isArray(r.body) && r.body.length === 0, JSON.stringify(r.body));

  // ---- 11. SLA expiry racing a Publisher accept -------------------
  await sql(`delete from requests where hoarding_id='${H.sla}'`);
  const slaReq = (await submit(v2, v2Id, H.sla, plusDays(5), plusDays(9))).body[0]?.id;
  await sql(`update requests set sla_deadline = now() - interval '1 hour' where id='${slaReq}'`);
  const [, confirmRes] = await Promise.all([
    sql(`select public.expire_stale_requests()`),
    confirm(pub, slaReq),
  ]);
  const finalSla = await statusOf(slaReq);
  const oneTransition = finalSla === "CONFIRMED" || finalSla === "EXPIRED";
  const consistent =
    finalSla === "CONFIRMED"
      ? confirmRes.status === 200
      : seeable(confirmRes.body) === "REQUEST_STATE_CONFLICT";
  ok("SLA-expiry vs ACCEPT: exactly one transition, consistent outcome", oneTransition && consistent, `final=${finalSla} confirm=${confirmRes.status}`);

  // ---- 12. expire is idempotent ---------------------------------
  await sql(`delete from requests where hoarding_id='${H.dup}'`);
  const staleA = (await submit(v2, v2Id, H.dup, plusDays(5), plusDays(9))).body[0]?.id;
  await sql(`update requests set sla_deadline = now() - interval '1 hour' where id='${staleA}'`);
  const first = (await sql(`select public.expire_stale_requests() as n`))[0].n;
  const second = (await sql(`select public.expire_stale_requests() as n`))[0].n;
  ok("expire_stale_requests() is idempotent (2nd run expires 0)", first >= 1 && second === 0, `first=${first} second=${second}`);

  // ---- 13. pg_cron jobs are scheduled ---------------------------
  const jobs = await sql(`select jobname from cron.job where jobname like 'seeable-%' order by jobname`);
  ok("the three pg_cron jobs are scheduled", jobs.length === 3, JSON.stringify(jobs.map((j) => j.jobname)));

  // ---- 14. disintermediation (RISK-16) -------------------------
  r = await v1(`viewer_request_list?hoarding_id=eq.${H.main}&select=*`);
  let blob = JSON.stringify(r.body);
  ok("Viewer's request list carries business_name, never publisher phone/email/full_name",
    blob.includes("Req Media") && !blob.includes("@ex.com") && !/"phone"/.test(blob) && !/full_name/.test(blob),
    blob.slice(0, 200));
  r = await pub(`publisher_inbox?hoarding_id=eq.${H.race}&select=*`);
  blob = JSON.stringify(r.body);
  ok("Publisher inbox shows the Viewer's name but not their phone/email",
    /viewer_name/.test(blob) && !blob.includes("@ex.com") && !/"phone"/.test(blob),
    blob.slice(0, 200));
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
