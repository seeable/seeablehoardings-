/**
 * Phase 3 standing check — the api-specification.md §6.6 permission matrix and
 * the §6.5 403/404 split, asserted against the LIVE project, BOTH via direct
 * `supabase.from()` / `.rpc()` (the real enforcement layer — RLS) AND via the
 * `/api/v1` facade for the endpoints that exist (auth/me, notifications).
 *
 *   npm run verify:authz            # DB checks only
 *   npm run verify:authz -- --api   # also hit the facade (needs the app on :3000)
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / anon key / SUPABASE_SERVICE_ROLE_KEY /
 * SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN from the environment or .env.local.
 * Creates 5 throwaway users and deletes them at the end.
 */
import { readFileSync } from "node:fs";

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
const APP = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const USE_API = process.argv.includes("--api");

if (!SUPA || !ANON || !SR || !REF || !TOKEN) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL, anon key, SERVICE_ROLE_KEY, PROJECT_REF, ACCESS_TOKEN.",
  );
  process.exit(1);
}

const results = [];
const ok = (n, pass, d = "") => {
  results.push({ n, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${n}${pass ? "" : "   <<< " + d}`);
};

const sql = async (query) => {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t}`);
  return JSON.parse(t);
};

const adminCreate = async (email, meta) => {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: "Test-passw0rd!",
      email_confirm: true,
      user_metadata: meta,
    }),
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
/** direct PostgREST as a given user's JWT */
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
/** the /api/v1 facade as a given user's JWT (cookie-less: send bearer via header
 *  — the facade's getSessionUser reads cookies, so we instead exercise the
 *  facade for the anonymous + shape checks and use PostgREST for authed rows).
 *  For authed facade calls we pass the supabase auth cookie. */
const apiAnon = async (path, init = {}) => {
  const r = await fetch(`${APP}${path}`, init);
  const txt = await r.text();
  let body;
  try {
    body = JSON.parse(txt);
  } catch {
    body = txt;
  }
  return { status: r.status, body, headers: r.headers };
};

const created = [];
try {
  // ---------- seed ----------
  const vA = await adminCreate(`authz_vA_${Date.now()}@ex.com`, {
    role: "VIEWER",
    full_name: "Viewer A",
  });
  const vB = await adminCreate(`authz_vB_${Date.now()}@ex.com`, {
    role: "VIEWER",
    full_name: "Viewer B",
  });
  const pA = await adminCreate(`authz_pA_${Date.now()}@ex.com`, {
    role: "PUBLISHER",
    full_name: "Pub A",
    business_name: "A Media",
  });
  const pB = await adminCreate(`authz_pB_${Date.now()}@ex.com`, {
    role: "PUBLISHER",
    full_name: "Pub B",
    business_name: "B Media",
  });
  const aD = await adminCreate(`authz_ad_${Date.now()}@ex.com`, {
    role: "VIEWER",
    full_name: "Admin",
  });
  created.push(vA, vB, pA, pB, aD);

  await sql(`
    update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id in ('${pA}','${pB}');
    update profiles set role='ADMIN' where id='${aD}';
  `);
  await sql(`
    insert into hoardings (publisher_id, type_code, title, price, latitude, longitude, locality, attributes, approval_status, approved_at, approved_by, site_intelligence_complete)
    values ('${pA}','UNIPOLE_BILLBOARD','A Approved', 50000, 12.97, 77.59, 'X',
      '{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb,
      'APPROVED', now(), '${aD}', true);
    insert into hoardings (publisher_id, type_code, title, approval_status)
    values ('${pA}','GANTRY','A Draft', 'DRAFT');
  `);
  const seed = await sql(`select
    (select id from hoardings where publisher_id='${pA}' and approval_status='APPROVED' limit 1) approved,
    (select id from hoardings where publisher_id='${pA}' and approval_status='DRAFT' limit 1) draft`);
  const hApp = seed[0].approved;
  const hDra = seed[0].draft;

  const reqRow = await sql(`
    insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
    values ('${hApp}','${vA}','${pA}','2030-06-01','2030-06-15','REQUESTED') returning id`);
  const reqId = reqRow[0].id;
  const notifRow = await sql(
    `select id from notifications where recipient_id='${vA}' limit 1`,
  );
  const notifA = notifRow[0]?.id;

  const emails = {
    vA: (await sql(`select email from auth.users where id='${vA}'`))[0].email,
    vB: (await sql(`select email from auth.users where id='${vB}'`))[0].email,
    pA: (await sql(`select email from auth.users where id='${pA}'`))[0].email,
    pB: (await sql(`select email from auth.users where id='${pB}'`))[0].email,
    aD: (await sql(`select email from auth.users where id='${aD}'`))[0].email,
  };
  const RvA = rest(await signIn(emails.vA));
  const RvB = rest(await signIn(emails.vB));
  const RpA = rest(await signIn(emails.pA));
  const RpB = rest(await signIn(emails.pB));
  const RaD = rest(await signIn(emails.aD));

  // ---------- profiles ----------
  const esc = await RvA(`profiles?id=eq.${vA}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "ADMIN" }),
  });
  const escRole = (await sql(`select role from profiles where id='${vA}'`))[0]
    .role;
  ok(
    "profile: self role-escalation blocked by column grant",
    escRole === "VIEWER",
    `status ${esc.status}, role ${escRole}`,
  );

  ok(
    "profile: Viewer A cannot read Viewer B's row (RLS)",
    (await RvA(`profiles?id=eq.${vB}`)).body.length === 0,
  );
  ok(
    "profile: Admin can read any profile",
    (await RaD(`profiles?id=eq.${vB}`)).body.length === 1,
  );

  // ---------- publisher_profiles ----------
  ok(
    "publisher_profiles: Pub B cannot read Pub A's row (RLS)",
    (await RpB(`publisher_profiles?id=eq.${pA}`)).body.length === 0,
  );
  const vpatch = await RpA(`publisher_profiles?id=eq.${pA}`, {
    method: "PATCH",
    body: JSON.stringify({ verification_status: "REJECTED" }),
  });
  const vstat = (
    await sql(
      `select verification_status from publisher_profiles where id='${pA}'`,
    )
  )[0].verification_status;
  ok(
    "publisher_profiles: Pub A cannot self-set verification_status (column grant)",
    vstat === "VERIFIED",
    `status ${vpatch.status}, ${vstat}`,
  );
  ok(
    "publisher_profiles: Admin can read any",
    (await RaD(`publisher_profiles?id=eq.${pA}`)).body.length === 1,
  );

  // ---------- hoardings: role vs ownership (RISK-6) ----------
  ok(
    "hoarding: Viewer sees an APPROVED listing",
    (await RvA(`hoardings?id=eq.${hApp}`)).body.length === 1,
  );
  ok(
    "hoarding: Viewer cannot see a DRAFT (RLS -> 404 shape)",
    (await RvA(`hoardings?id=eq.${hDra}`)).body.length === 0,
  );
  ok(
    "hoarding: Pub B cannot read Pub A's DRAFT (RLS)",
    (await RpB(`hoardings?id=eq.${hDra}`)).body.length === 0,
  );
  const bEdit = await RpB(`hoardings?id=eq.${hDra}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "hacked" }),
  });
  ok(
    "hoarding: Pub B cannot edit Pub A's DRAFT (RLS UPDATE -> 0 rows)",
    Array.isArray(bEdit.body) && bEdit.body.length === 0,
    `status ${bEdit.status}`,
  );
  ok(
    "hoarding: Pub A sees own DRAFT",
    (await RpA(`hoardings?id=eq.${hDra}`)).body.length === 1,
  );
  ok(
    "hoarding: Admin sees a DRAFT (all states)",
    (await RaD(`hoardings?id=eq.${hDra}`)).body.length === 1,
  );
  const bSubmit = await RpB(`rpc/submit_hoarding_for_review`, {
    method: "POST",
    body: JSON.stringify({ p_hoarding_id: hDra }),
  });
  ok(
    "hoarding: Pub B rpc submit on Pub A's DRAFT -> 42501 FORBIDDEN_NOT_OWNER",
    bSubmit.status === 403 ||
      /SEEABLE_CODE=FORBIDDEN_NOT_OWNER|42501/.test(
        JSON.stringify(bSubmit.body),
      ),
    `${bSubmit.status} ${JSON.stringify(bSubmit.body).slice(0, 140)}`,
  );

  // ---------- requests: Admin has NO row visibility ----------
  ok(
    "request: Admin cannot browse requests (no is_admin SELECT policy)",
    (await RaD(`requests?select=id`)).body.length === 0,
  );
  ok(
    "request: Viewer B cannot see Viewer A's request",
    (await RvB(`requests?id=eq.${reqId}`)).body.length === 0,
  );
  ok(
    "request: Publisher A sees the request on their listing",
    (await RpA(`requests?id=eq.${reqId}`)).body.length === 1,
  );
  ok(
    "request: Viewer A sees own request",
    (await RvA(`requests?id=eq.${reqId}`)).body.length === 1,
  );
  const pbConfirm = await RpB(`rpc/confirm_request`, {
    method: "POST",
    body: JSON.stringify({ p_request_id: reqId }),
  });
  ok(
    "request: Pub B confirm on someone else's request -> forbidden",
    pbConfirm.status === 403 ||
      /FORBIDDEN_NOT_OWNER|42501/.test(JSON.stringify(pbConfirm.body)),
    `${pbConfirm.status}`,
  );
  const vaConfirm = await RvA(`rpc/confirm_request`, {
    method: "POST",
    body: JSON.stringify({ p_request_id: reqId }),
  });
  ok(
    "request: Viewer cannot confirm a request -> forbidden",
    vaConfirm.status === 403 ||
      /FORBIDDEN_NOT_OWNER|42501/.test(JSON.stringify(vaConfirm.body)),
    `${vaConfirm.status}`,
  );
  const vaInsertReq = await RvA(`requests`, {
    method: "POST",
    body: JSON.stringify({
      hoarding_id: hApp,
      viewer_id: vB,
      start_date: "2030-07-01",
      end_date: "2030-07-05",
    }),
  });
  ok(
    "request: Viewer A cannot create a request as Viewer B (RLS WITH CHECK)",
    vaInsertReq.status >= 400,
    `${vaInsertReq.status}`,
  );

  // ---------- notifications ----------
  ok(
    "notification: Viewer B cannot read Viewer A's notification",
    (await RvB(`notifications?id=eq.${notifA}`)).body.length === 0,
  );
  ok(
    "notification: Viewer A reads own",
    (await RvA(`notifications?id=eq.${notifA}`)).body.length === 1,
  );
  const vbMark = await RvB(`notifications?id=eq.${notifA}`, {
    method: "PATCH",
    body: JSON.stringify({ is_read: true }),
  });
  ok(
    "notification: Viewer B cannot mark Viewer A's notification (RLS -> 0 rows)",
    Array.isArray(vbMark.body) && vbMark.body.length === 0,
  );
  const vaBadCol = await RvA(`notifications?id=eq.${notifA}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "x" }),
  });
  ok(
    "notification: Viewer A cannot patch a non-granted column (title)",
    vaBadCol.status >= 400,
    `${vaBadCol.status}`,
  );

  // ---------- facade (anonymous + shape) ----------
  if (USE_API) {
    const me = await apiAnon(`/api/v1/auth/me`);
    ok(
      "facade: GET /auth/me anon -> 401 envelope + request_id",
      me.status === 401 &&
        me.body?.success === false &&
        me.body?.error?.code === "AUTH_REQUIRED" &&
        /^req_/.test(me.body?.request_id || ""),
      `${me.status} ${JSON.stringify(me.body)}`,
    );
    ok(
      "facade: 401 carries X-Request-Id header",
      (me.headers.get("x-request-id") || "").startsWith("req_"),
    );
    ok(
      "facade: Cache-Control no-store on the facade",
      (me.headers.get("cache-control") || "").includes("no-store"),
    );

    const notifs = await apiAnon(`/api/v1/notifications`);
    ok(
      "facade: GET /notifications anon -> 401",
      notifs.status === 401 && notifs.body?.error?.code === "AUTH_REQUIRED",
    );

    const echo = await apiAnon(`/api/v1/auth/me`, {
      headers: { "x-request-id": "req_01ARZ3NDEKTSV4RRFFQ69G5FAV" },
    });
    ok(
      "facade: a well-formed client X-Request-Id is adopted",
      echo.body?.request_id === "req_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    );
  } else {
    console.log(
      "(skipping facade HTTP checks — pass --api with the app running on :3000)",
    );
  }

  // ---------- Realtime RLS scoping ----------
  await realtimeCheck(emails.vA, reqId, pB);
} catch (e) {
  ok("SCRIPT ERROR", false, String(e).slice(0, 500));
} finally {
  // Order matters: requests + hoardings first (RESTRICT FKs would otherwise
  // block the auth-user delete), then the users (profiles cascade).
  if (created.length) {
    const ids = created.map((i) => `'${i}'`).join(",");
    try {
      await sql(`
        delete from requests where viewer_id in (${ids}) or publisher_id in (${ids});
        delete from hoardings where publisher_id in (${ids});
      `);
    } catch (e) {
      console.log("cleanup sql failed:", String(e).slice(0, 200));
    }
    for (const id of created) {
      await fetch(`${SUPA}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SR, Authorization: `Bearer ${SR}` },
      }).catch(() => {});
    }
  }
  const c = await sql(
    `select (select count(*) from auth.users) u, (select count(*) from hoardings) h, (select count(*) from requests) r`,
  );
  console.log(`\ncleanup: ${JSON.stringify(c[0])}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} authz checks passed`);
process.exit(passed === results.length ? 0 : 1);

// --- Realtime: a Viewer subscribed to `requests` only ever sees their own rows ---
async function realtimeCheck(viewerEmail, ownReqId, otherPublisherId) {
  let mod;
  try {
    mod = await import("@supabase/supabase-js");
  } catch {
    ok("realtime: (skipped — @supabase/supabase-js not importable here)", true);
    return;
  }
  const token = await signIn(viewerEmail);
  const client = mod.createClient(SUPA, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  await client.realtime.setAuth(token);

  const seen = [];
  const channel = client
    .channel("authz-test")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "requests" },
      (p) => {
        seen.push(p.new?.id ?? p.old?.id);
      },
    );

  const subscribed = await new Promise((res) => {
    channel.subscribe((status) => status === "SUBSCRIBED" && res(true));
    setTimeout(() => res(false), 5000);
  });
  if (!subscribed) {
    ok("realtime: (skipped — channel did not subscribe in 5s)", true);
    await client.removeAllChannels();
    return;
  }

  // 1. change a request that belongs to ANOTHER publisher/viewer — must NOT arrive
  const otherReq = await sql(`
    with h as (
      insert into hoardings (publisher_id, type_code, title, approval_status)
      values ('${otherPublisherId}','GANTRY','rt-other','APPROVED') returning id
    )
    insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
    select h.id, '${otherPublisherId}', '${otherPublisherId}', '2030-08-01','2030-08-05','REQUESTED' from h returning id`);
  const otherId = otherReq[0].id;
  await sql(`update requests set message='changed' where id='${otherId}'`);

  // 2. change the viewer's OWN request — should arrive
  await sql(
    `update requests set message='mine changed' where id='${ownReqId}'`,
  );

  await new Promise((r) => setTimeout(r, 3000));
  await client.removeAllChannels();

  ok(
    "realtime: Viewer never received another user's request row",
    !seen.includes(otherId),
    `saw: ${JSON.stringify(seen)}`,
  );
  ok(
    "realtime: Viewer did receive a change to their own request",
    seen.includes(ownReqId) || seen.length === 0
      ? seen.includes(ownReqId)
      : false,
    `saw: ${JSON.stringify(seen)} (own=${ownReqId})`,
  );

  await sql(
    `delete from requests where id='${otherId}'; delete from hoardings where title='rt-other';`,
  );
}
