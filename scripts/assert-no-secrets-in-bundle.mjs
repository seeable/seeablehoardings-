/**
 * Fail if the service-role key, the admin client, or any obvious secret made it
 * into a browser-shipped bundle — api-specification.md §6.3, §33.
 * Run AFTER `next build`:  node scripts/assert-no-secrets-in-bundle.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [".next/static", ".open-next/assets/_next"];
const SR_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

// Patterns that must never appear in client JS.
const FORBIDDEN = [
  {
    name: "service-role key value",
    test: (s) => SR_KEY.length > 12 && s.includes(SR_KEY),
  },
  { name: "createAdminClient", test: (s) => s.includes("createAdminClient") },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY reference",
    test: (s) => s.includes("SUPABASE_SERVICE_ROLE_KEY"),
  },
  {
    name: "SUPABASE_ACCESS_TOKEN reference",
    test: (s) => s.includes("SUPABASE_ACCESS_TOKEN"),
  },
  {
    name: "sb_secret_ prefix",
    test: (s) => /sb_secret_[A-Za-z0-9_-]{8,}/.test(s),
  },
];

function* jsFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* jsFiles(p);
    else if (/\.(js|mjs|cjs)$/.test(e)) yield p;
  }
}

let scanned = 0;
const hits = [];
for (const root of ROOTS) {
  for (const file of jsFiles(root)) {
    scanned++;
    const src = readFileSync(file, "utf8");
    for (const rule of FORBIDDEN) {
      if (rule.test(src)) hits.push(`${rule.name}  ->  ${file}`);
    }
  }
}

if (scanned === 0) {
  console.error("No client bundle found — run `npm run build` first.");
  process.exit(1);
}
if (hits.length) {
  console.error(
    `✗ secret material in client bundle (${scanned} files scanned):`,
  );
  for (const h of hits) console.error("  " + h);
  process.exit(1);
}
console.log(
  `✓ ${scanned} client bundle files clean — no service-role material.`,
);
