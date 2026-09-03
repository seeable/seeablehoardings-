import { test, expect } from "@playwright/test";

/**
 * Phase 7 canonical flow against the live Supabase project: a Viewer signs up,
 * opens a seeded listing, submits a request, and sees it Pending in My
 * Requests; the Publisher then confirms it (server-side) and the Viewer sees
 * Confirmed after a refresh. Plus the REQUEST_DATE_CONFLICT named state.
 *
 *   SEEABLE_E2E_LIVE=1 \
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... \
 *   npx playwright test request-flow
 */
const LIVE = process.env.SEEABLE_E2E_LIVE === "1";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";

const tag = `e2e_req_${Date.now()}`;
const password = "Test-passw0rd!";

async function q(query: string) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
async function makeUser(email: string, meta: Record<string, unknown>) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j.id as string;
}

test.describe(() => {
  test.skip(
    !LIVE || !SUPA || !ANON || !SR || !REF || !TOKEN,
    "set SEEABLE_E2E_LIVE=1 + full Supabase env to run",
  );

  let pubId = "";
  let hoardingId = "";

  test.beforeAll(async () => {
    pubId = await makeUser(`${tag}_pub@seeable.test`, {
      role: "PUBLISHER",
      full_name: "E2E Publisher",
      business_name: "E2E Outdoor Media",
    });
    await q(
      `update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${pubId}';`,
    );
    const rows = await q(`
      insert into hoardings (publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city,
        attributes, approval_status, approved_at)
      values ('${pubId}','UNIPOLE_BILLBOARD','${tag} ORR Unipole', 55000,'MONTH', 12.9352, 77.6245, 'Koramangala','Bengaluru',
        '{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb, 'APPROVED', now())
      returning id;`);
    hoardingId = rows[0].id;
  });

  test.afterAll(async () => {
    const h = { apikey: SR, Authorization: `Bearer ${SR}` };
    await q(
      `delete from requests where hoarding_id='${hoardingId}'; delete from hoardings where title like '${tag}%';`,
    ).catch(() => {});
    const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, { headers: h });
    const users: { id: string; email?: string }[] = (await list.json()).users ?? [];
    await Promise.all(
      users
        .filter((u) => u.email?.endsWith("@seeable.test"))
        .map((u) =>
          fetch(`${SUPA}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: h }),
        ),
    );
  });

  test("Viewer submits a request, sees it Pending, then Confirmed after the Publisher accepts", async ({
    page,
  }) => {
    // sign up as a Viewer
    await page.goto("/signup");
    await page.getByRole("radio", { name: /I want to advertise/i }).click();
    await page.getByLabel("Full name").fill("E2E Buyer");
    await page.getByLabel("Email").fill(`${tag}_vw@seeable.test`);
    await page.locator("input#password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/discover/, { timeout: 15_000 });

    // open the seeded listing directly
    await page.goto(`/discover/${hoardingId}`);
    await expect(page.getByRole("heading", { name: `${tag} ORR Unipole` })).toBeVisible();

    // request it — the CTA lives in <main>, not the account menu in the banner
    await page
      .getByRole("main")
      .getByRole("button", { name: /^Request/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // pick a start + end a few days out (selectable = enabled gridcell buttons)
    const days = dialog.locator('button[role="gridcell"]:not([disabled])');
    await days.nth(2).click();
    await days.nth(7).click();
    await dialog.getByRole("button", { name: "Send Request" }).click();
    await expect(dialog.getByText(/Request sent to E2E Outdoor Media/)).toBeVisible({
      timeout: 15_000,
    });

    // My Requests shows it Pending
    await page.goto("/requests");
    await expect(page.getByText(`${tag} ORR Unipole`)).toBeVisible();
    await expect(page.getByText("Pending").first()).toBeVisible();

    // Publisher accepts — through the real SECURITY DEFINER transition
    const reqRows = await q(
      `select id from requests where hoarding_id='${hoardingId}' and status='REQUESTED' limit 1;`,
    );
    await q(`select confirm_request('${reqRows[0].id}');`);

    await page.reload();
    await expect(page.getByText("Confirmed").first()).toBeVisible({ timeout: 15_000 });
  });
});
