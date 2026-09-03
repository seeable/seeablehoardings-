import { test, expect } from "@playwright/test";

/**
 * Full sign-up / sign-in / sign-out round trip against the live Supabase
 * project. Creates a throwaway user and deletes it afterwards, so it only runs
 * when explicitly enabled and given a service-role key.
 *
 *   SEEABLE_E2E_LIVE=1 \
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx playwright test live-auth-flow
 */
const LIVE = process.env.SEEABLE_E2E_LIVE === "1";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

test.describe(() => {
  test.skip(
    !LIVE || !SUPA || !SR,
    "set SEEABLE_E2E_LIVE=1 + Supabase env to run",
  );

  const email = `e2e_${Date.now()}@seeable.test`;
  const password = "Test-passw0rd!";

  // Delete every @seeable.test user — this run's, plus any left by a crash.
  test.afterAll(async () => {
    const h = { apikey: SR, Authorization: `Bearer ${SR}` };
    const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, {
      headers: h,
    });
    const users: { id: string; email?: string }[] =
      (await list.json()).users ?? [];
    await Promise.all(
      users
        .filter((u) => u.email?.endsWith("@seeable.test"))
        .map((u) =>
          fetch(`${SUPA}/auth/v1/admin/users/${u.id}`, {
            method: "DELETE",
            headers: h,
          }),
        ),
    );
  });

  test("sign up (viewer) -> discover, sign out -> home, sign in -> discover, bad password -> error", async ({
    page,
  }) => {
    // sign up
    await page.goto("/signup");
    await page.getByRole("radio", { name: /I want to advertise/i }).click();
    await page.getByLabel("Full name").fill("E2E Viewer");
    await page.getByLabel("Email").fill(email);
    await page.locator("input#password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/discover/, { timeout: 15_000 });

    // the authenticated shell is up: primary nav + the notification bell
    await expect(
      page.getByRole("navigation", { name: "Primary" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Notifications/ })).toBeVisible();

    // sign out — via the account menu in the top bar
    await page.getByRole("button", { name: /E2E Viewer/i }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    // wrong password
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.locator("input#password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // correct password
    await page.locator("input#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/discover/, { timeout: 15_000 });
  });
});
