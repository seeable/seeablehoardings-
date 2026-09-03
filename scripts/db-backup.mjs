/**
 * Weekly logical backup of the SEEABLE database.
 * IMPLEMENTATION-PLAN.md §Phase 1 DoD — "weekly pg_dump script exists".
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:PW@db.<ref>.supabase.co:5432/postgres" \
 *   node scripts/db-backup.mjs [outDir]
 *
 * Or, with the Supabase CLI linked to a project (`supabase link`):
 *   node scripts/db-backup.mjs            # uses `supabase db dump`
 *
 * Writes three files (roles, schema, data) to <outDir>/<yyyy-mm-dd>/ — the same
 * split `supabase db dump` produces, so a restore is:
 *   psql "$SUPABASE_DB_URL" -f roles.sql -f schema.sql -f data.sql
 *
 * Wire this to a scheduler you already run (GitHub Actions `schedule:`, a laptop
 * cron, etc). It is intentionally NOT a pg_cron job — pg_cron cannot write files.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outRoot = process.argv[2] ?? "backups";
const stamp = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
const dir = join(outRoot, stamp);
mkdirSync(dir, { recursive: true });

const DB_URL = process.env.SUPABASE_DB_URL;
const run = (args) => {
  process.stdout.write(`  supabase ${args.join(" ")}\n`);
  execFileSync("supabase", args, { stdio: "inherit" });
};

console.log(`SEEABLE backup -> ${dir}`);
try {
  const base = DB_URL ? ["--db-url", DB_URL] : [];
  run(["db", "dump", ...base, "--role-only", "-f", join(dir, "roles.sql")]);
  run(["db", "dump", ...base, "-f", join(dir, "schema.sql")]);
  run(["db", "dump", ...base, "--data-only", "-f", join(dir, "data.sql")]);
  console.log("backup complete.");
} catch (err) {
  console.error("backup FAILED:", err.message);
  process.exit(1);
}
