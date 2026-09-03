import { test, expect } from "@playwright/test";

test("walking skeleton renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "SEEABLE Hoardings" }),
  ).toBeVisible();
  await expect(page.getByText("@supabase/supabase-js")).toBeVisible();
});

test("health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  // 200 (all checks ok) or 503 (degraded, e.g. placeholder Supabase creds) —
  // both are valid; a 500 or a connection failure is not.
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body).toHaveProperty("checks");
});
