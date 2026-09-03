import { test, expect } from "@playwright/test";

/**
 * Phase 9 flow against the live Supabase project: an Admin signs in, approves a
 * pending listing (it then appears in Discover), and verifies a pending
 * Publisher (the OWNER-004 gate lifts).
 *
 *   SEEABLE_E2E_LIVE=1 <full Supabase env> npx playwright test admin-flow
 */
const LIVE = process.env.SEEABLE_E2E_LIVE === "1";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";

const tag = `e2e_adm_${Date.now()}`;
const password = "Test-passw0rd!";

async function q(query: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
async function createUser(email: string, meta: Record<string, unknown>) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`create ${email}: ${JSON.stringify(j)}`);
  return j.id as string;
}

const ATTRS =
  `'{"height_ft":20,"width_ft":40,"illumination":"backlit","facing_direction":"north"}'::jsonb`;

test.describe(() => {
  test.skip(
    !LIVE || !SUPA || !ANON || !SR || !REF || !TOKEN,
    "set SEEABLE_E2E_LIVE=1 + full Supabase env to run",
  );

  const adminEmail = `${tag}_admin@seeable.test`;
  const pubEmail = `${tag}_pub@seeable.test`;
  let hoardingId = "";

  test.beforeAll(async () => {
    await createUser(adminEmail, { role: "VIEWER", full_name: "E2E Admin" });
    const pubId = await createUser(pubEmail, {
      role: "PUBLISHER",
      full_name: "E2E Owner",
      business_name: "E2E Signs",
    });
    hoardingId = (await q("select gen_random_uuid() id"))[0].id;
    await q(`update profiles set role='ADMIN' where email='${adminEmail}';`);
    await q(
      `update publisher_profiles set verification_status='PENDING', business_name='E2E Signs Pvt Ltd', business_type='Private limited company', verification_submitted_at=now() where id='${pubId}';`,
    );
    await q(`insert into hoardings
      (id, publisher_id, type_code, title, price, price_unit, latitude, longitude, locality, city, attributes, approval_status)
      values ('${hoardingId}','${pubId}','UNIPOLE_BILLBOARD','${tag} ORR Unipole',
              75000,'MONTH',12.97,77.62,'Marathahalli','Bengaluru',${ATTRS},'PENDING_REVIEW');`);
  });

  test.afterAll(async () => {
    const h = { apikey: SR, Authorization: `Bearer ${SR}` };
    await q(
      `delete from admin_actions where target_hoarding_id='${hoardingId}';
       delete from hoardings where title like '${tag}%';`,
    );
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

  test("admin signs in → approves a listing → it reaches Discover; verifies a publisher", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.locator("input#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin\/overview/, { timeout: 15_000 });

    // AD-01 — the pending-approvals card, then deep-link into AD-02
    await expect(page.getByText("Pending listing approvals")).toBeVisible();
    await page.goto("/admin/inventory?view=listings&tab=PENDING_REVIEW");

    // AD-04 — review + approve
    await page
      .getByRole("row", { name: new RegExp(`${tag} ORR Unipole`) })
      .getByRole("button", { name: "Review" })
      .click();
    await expect(page.getByRole("dialog")).toContainText(`${tag} ORR Unipole`);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () =>
        (await q(`select approval_status from hoardings where id='${hoardingId}'`))[0]
          .approval_status,
      )
      .toBe("APPROVED");

    // it left the approval queue, and it is now in public_hoarding_detail (ADMIN-001)
    await page.goto("/admin/inventory?view=listings&tab=PENDING_REVIEW");
    await expect(
      page.getByRole("row", { name: new RegExp(`${tag} ORR Unipole`) }),
    ).toHaveCount(0);
    expect(
      (await q(`select count(*)::int n from public_hoarding_detail where id='${hoardingId}'`))[0].n,
    ).toBe(1);

    // AD-03 — verify the pending publisher
    await page.goto("/admin/inventory?view=publishers&tab=PENDING");
    await page
      .getByRole("row", { name: /E2E Signs Pvt Ltd/ })
      .getByRole("button", { name: "Review" })
      .click();
    await page.getByRole("button", { name: "Verify publisher" }).click();
    await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () =>
        (await q(`select verification_status from publisher_profiles pp
                  join profiles p on p.id = pp.id where p.email='${pubEmail}'`))[0]
          .verification_status,
      )
      .toBe("VERIFIED");
  });
});
