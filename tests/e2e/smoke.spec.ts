import { test, expect } from "@playwright/test";

test("landing (AUTH-01) renders with the CTA pair", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /outdoor advertising, in one place/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("signup role step renders both role cards", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("radio", { name: /I want to advertise/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /I want to list my hoardings/i }),
  ).toBeVisible();
});

test("unauthenticated visit to a protected route redirects to /login", async ({
  page,
}) => {
  await page.goto("/discover");
  await expect(page).toHaveURL(/\/login/);
});

test("health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body).toHaveProperty("checks");
});
