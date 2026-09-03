import { test, expect } from "@playwright/test";

/**
 * Phase 8 flow against the live Supabase project: a brand-new Publisher signs
 * up, sees the "Add your first hoarding" dashboard, submits PB-08 verification
 * (with a document), lands in the pending state, and — after an Admin verifies —
 * the banner clears.
 *
 *   SEEABLE_E2E_LIVE=1 <full Supabase env> npx playwright test publisher-verification
 */
const LIVE = process.env.SEEABLE_E2E_LIVE === "1";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";

const tag = `e2e_pv_${Date.now()}`;
const email = `${tag}@seeable.test`;
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

test.describe(() => {
  test.skip(
    !LIVE || !SUPA || !ANON || !SR || !REF || !TOKEN,
    "set SEEABLE_E2E_LIVE=1 + full Supabase env to run",
  );

  test.afterAll(async () => {
    const h = { apikey: SR, Authorization: `Bearer ${SR}` };
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

  test("brand-new Publisher: empty dashboard → submit verification → pending → verified clears the banner", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByRole("radio", { name: /list my hoardings/i }).click();
    await page.getByLabel("Full name").fill("E2E Owner");
    await page.getByLabel(/Business name/i).fill("E2E Signs");
    await page.getByLabel("Email").fill(email);
    await page.locator("input#password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/publisher\/dashboard/, { timeout: 15_000 });

    // brand-new: the single prompt, not four zero cards
    await expect(
      page.getByRole("heading", { name: "Add your first hoarding" }),
    ).toBeVisible();
    await expect(page.getByText(/pending verification|Get verified/i)).toBeVisible();

    // PB-08
    await page.goto("/publisher/verify");
    await page.getByLabel(/Registered business name/i).fill("E2E Signs Pvt Ltd");
    await page
      .getByLabel(/Business type/i)
      .selectOption("Private limited company");
    await page.locator('input[type="file"]').setInputFiles({
      name: "registration.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
    });
    await page.getByRole("button", { name: /Submit for verification/i }).click();
    await expect(page.getByText(/under review/i)).toBeVisible({ timeout: 15_000 });

    // Admin verifies out of band
    const rows = await q(
      `select id from profiles where email='${email}';`,
    );
    await q(
      `update publisher_profiles set verification_status='VERIFIED', verified_at=now() where id='${rows[0].id}';`,
    );

    await page.goto("/publisher/hoardings");
    await expect(page.getByText(/Get verified|pending verification/i)).toHaveCount(0);
  });
});
