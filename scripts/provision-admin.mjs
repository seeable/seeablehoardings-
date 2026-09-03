/**
 * Provision an ADMIN account out of band — api-specification.md §6.1,
 * database-design.md §15, IMPLEMENTATION-PLAN.md §Phase 3.
 *
 * There is NO public path to ADMIN: the sign-up form can't offer it and
 * `handle_new_user` downgrades a forged `role:ADMIN` to VIEWER. An operator
 * runs this against an ALREADY-REGISTERED account.
 *
 *   node scripts/provision-admin.mjs [email]
 *
 * `email` defaults to ADMIN_BOOTSTRAP_EMAIL. Needs NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY in the environment (or in .env.local).
 *
 * See docs/runbooks/admin-provisioning.md.
 */
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      if (env[k] === undefined) env[k] = line.slice(i + 1).trim();
    }
  } catch {
    /* .env.local optional */
  }
  return env;
}

const env = loadEnv();
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] ?? env.ADMIN_BOOTSTRAP_EMAIL ?? "")
  .trim()
  .toLowerCase();

if (!SUPA || !SR) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}
if (!email) {
  console.error(
    "Usage: node scripts/provision-admin.mjs <email>  (or set ADMIN_BOOTSTRAP_EMAIL)",
  );
  process.exit(1);
}

const h = {
  apikey: SR,
  Authorization: `Bearer ${SR}`,
  "Content-Type": "application/json",
};

// 1. find the registered auth user
const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=1000`, {
  headers: h,
});
const users = (await list.json()).users ?? [];
const target = users.find((u) => (u.email ?? "").toLowerCase() === email);
if (!target) {
  console.error(
    `No registered user with email ${email}. Have them sign up first.`,
  );
  process.exit(1);
}

// 2. promote the profile (service role bypasses RLS + the role column grant)
const patch = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${target.id}`, {
  method: "PATCH",
  headers: { ...h, Prefer: "return=representation" },
  body: JSON.stringify({ role: "ADMIN" }),
});
const rows = await patch.json();
if (!patch.ok || !Array.isArray(rows) || rows.length !== 1) {
  console.error("Failed to update profile:", JSON.stringify(rows));
  process.exit(1);
}

console.log(`✓ ${email} (${target.id}) is now ADMIN.`);
if (rows[0].role !== "ADMIN")
  console.error("  (verify failed — role is", rows[0].role, ")");
console.log(
  "  Any leftover publisher_profiles row is harmless — an ADMIN never uses it.",
);
console.log("  To revoke: re-run with role VIEWER via the SQL editor.");
