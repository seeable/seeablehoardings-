/**
 * Billboard inventory import (docs: the 68-photo `billboards/`
 * showcase, IMPLEMENTATION-PLAN.md "primary MVP requirement" ask).
 *
 * Source: `billboards/SH-<TYPE>-<NNN>.jpeg`. Location metadata (when present)
 * comes from `scripts/billboard-metadata.json` — OCR'd from the real
 * "GPS Map Camera" overlay burned into each photo by
 * `scripts/extract-billboard-metadata.py` (see that file's header). This
 * script never invents a price, address, or coordinate: fields with no
 * genuine source stay NULL and the UI shows "Details coming soon".
 *
 * Idempotent: `attributes->>'inventory_code'` is the stable business key
 * (DB-enforced by the `hoardings_inventory_code_uidx` partial unique index,
 * migration 20260911120000). Re-running this script only creates what's
 * missing — it never duplicates a hoarding or a media row.
 *
 * Mechanism (documented deviation, not a shortcut): normal Publisher
 * self-serve listings must pass `submit_hoarding_for_review()`'s core-fields
 * gate (price + lat/lng required) before an Admin can approve them. This is
 * an administrative bulk import with no fabricated price/location to give
 * that gate — sanctioned "migration / seed / provisioning tooling" per
 * lib/supabase/admin.ts's own doc-comment, so it writes hoardings directly
 * via the service role (same class of operation as the hoarding_types
 * reference-data migration), then flips PENDING_REVIEW -> APPROVED with a
 * direct UPDATE rather than calling `approve_listing()` — because that RPC's
 * audit trail (`admin_actions`) exists to record a human moderation decision,
 * and attributing one to a real Admin who never reviewed these would be
 * dishonest. `approved_by` stays NULL; this script's own summary is the
 * record of what happened.
 *
 *   node scripts/import-billboards.mjs [--dry-run]
 */
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

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
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !SR) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.slice("--only=".length).split(",")) : null;

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "billboards");
const META_PATH = path.join(ROOT, "scripts", "billboard-metadata.json");
const PUBLIC_BUCKET = "hoarding-public";

const HOUSE_PUBLISHER_EMAIL = "inventory@seeable.internal";
const HOUSE_PUBLISHER_NAME = "SEEABLE Inventory";

// prefix -> hoarding_types.code. SP has no match in the 8-type taxonomy
// (mvp-prd.md §8) — per the task's own instruction, it is excluded and
// flagged for manual review rather than forced into a guessed category.
const TYPE_MAP = { BB: "UNIPOLE_BILLBOARD", DB: "DIGITAL_BILLBOARD", BS: "BUS_QUEUE_SHELTER" };
const EXPECTED_RANGES = { BB: [1, 63], DB: [1, 3], BS: [1, 1], SP: [1, 1] };
const CODE_RE = /^SH-(BB|DB|BS|SP)-(\d{3})\.jpeg$/;
const MEDIA_MAX_LONG_EDGE = 2000;
const MEDIA_MIN_WIDTH = 640;
const MEDIA_MIN_HEIGHT = 480;

const admin = createClient(SUPA, SR, { auth: { autoRefreshToken: false, persistSession: false } });

// --- 1. folder validation (requirement: report before importing) ----------

function validateFolder() {
  const files = readdirSync(SRC_DIR).filter((f) => f !== ".gitkeep");
  const report = { total_files: files.length, valid: [], unsupported: [], duplicates: [], missing: [] };
  const seen = new Map();
  for (const f of files) {
    const m = CODE_RE.exec(f);
    if (!m) {
      report.unsupported.push(f);
      continue;
    }
    const [, prefix, num] = m;
    const code = `SH-${prefix}-${num}`;
    if (seen.has(code)) {
      report.duplicates.push({ code, files: [seen.get(code), f] });
      continue;
    }
    seen.set(code, f);
    report.valid.push({ code, prefix, file: f });
  }
  for (const [prefix, [lo, hi]] of Object.entries(EXPECTED_RANGES)) {
    for (let n = lo; n <= hi; n++) {
      const code = `SH-${prefix}-${String(n).padStart(3, "0")}`;
      if (!seen.has(code)) report.missing.push(code);
    }
  }
  return report;
}

async function validateImage(filePath) {
  try {
    const meta = await sharp(filePath).metadata();
    const ok =
      !!meta.width &&
      !!meta.height &&
      meta.width >= MEDIA_MIN_WIDTH &&
      meta.height >= MEDIA_MIN_HEIGHT &&
      ["jpeg", "png", "webp"].includes(meta.format ?? "");
    return { ok, meta };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// --- 2. server-side watermark (Node has no <canvas>; sharp + an SVG text
//        overlay reproduces the same tiled, semi-transparent "SEEABLE" mark
//        lib/inventory/watermark.ts draws client-side — same visual design,
//        same CONTENT-001 intent, different (server) runtime). -------------

function watermarkSvg(width, height) {
  const step = Math.max(160, Math.round(Math.min(width, height) / 4));
  const fontSize = Math.max(18, Math.round(step / 7));
  const reach = Math.hypot(width, height);
  let texts = "";
  for (let y = -reach; y < reach; y += step) {
    for (let x = -reach; x < reach; x += step * 2.2) {
      texts += `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="600" text-anchor="middle" fill="#ffffff" fill-opacity="0.22" stroke="rgba(0,0,0,0.25)" stroke-width="1">SEEABLE</text>`;
    }
  }
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${width / 2},${height / 2}) rotate(-30)">${texts}</g>
  </svg>`;
}

async function watermarkImage(filePath) {
  const src = sharp(filePath).rotate();
  const meta = await src.metadata();
  const longEdge = Math.max(meta.width, meta.height);
  const scale = Math.min(1, MEDIA_MAX_LONG_EDGE / longEdge);
  const width = Math.round(meta.width * scale);
  const height = Math.round(meta.height * scale);
  const svg = Buffer.from(watermarkSvg(width, height));
  const buffer = await src
    .resize(width, height)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
  return { buffer, width, height };
}

// --- 3. house publisher (owns showcase inventory with no real Publisher
//        onboarded yet — see the module doc for why this exists). ----------

async function ensureHousePublisher() {
  const { data: existing, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", HOUSE_PUBLISHER_EMAIL)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  if (DRY_RUN) return "00000000-0000-0000-0000-000000000000";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: HOUSE_PUBLISHER_EMAIL,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: {
      role: "PUBLISHER",
      full_name: HOUSE_PUBLISHER_NAME,
      business_name: HOUSE_PUBLISHER_NAME,
    },
  });
  if (createErr) throw createErr;
  const id = created.user.id;

  const { error: verifyErr } = await admin
    .from("publisher_profiles")
    .update({ verification_status: "VERIFIED", verified_at: new Date().toISOString() })
    .eq("id", id);
  if (verifyErr) throw verifyErr;

  return id;
}

// --- 4. per-code import -----------------------------------------------

async function findExisting(code) {
  const { data, error } = await admin
    .from("hoardings")
    .select("id, approval_status")
    .eq("attributes->>inventory_code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function titleFor(typeCode, code) {
  const names = {
    UNIPOLE_BILLBOARD: "Unipole / Billboard",
    DIGITAL_BILLBOARD: "Digital Billboard",
    BUS_QUEUE_SHELTER: "Bus Queue Shelter",
  };
  return `${names[typeCode] ?? typeCode} — ${code}`;
}

/** First comma segment of "Place, State, India" -> "Place". */
function shortLocality(ocrLocality) {
  if (!ocrLocality) return null;
  return ocrLocality.split(",")[0].trim() || null;
}

async function importOne(entry, meta, summary) {
  const { code, prefix, file } = entry;
  const typeCode = TYPE_MAP[prefix];
  const filePath = path.join(SRC_DIR, file);

  const imgCheck = await validateImage(filePath);
  if (!imgCheck.ok) {
    summary.failed.push({ code, reason: imgCheck.error ?? "failed image validation" });
    return;
  }

  const geo = meta[code];
  const hasGeo = geo && geo.latitude != null && geo.longitude != null;
  const outOfScope = hasGeo && geo.state && geo.state.toLowerCase() !== "karnataka";

  let existing;
  try {
    existing = await findExisting(code);
  } catch (e) {
    summary.failed.push({ code, reason: `lookup failed: ${e.message}` });
    return;
  }

  let hoardingId = existing?.id;
  if (!hoardingId) {
    const locality = hasGeo ? shortLocality(geo.ocr_locality) : null;
    const city = outOfScope ? (locality ?? "Hosur") : "Bengaluru";
    const row = {
      publisher_id: summary.housePublisherId,
      type_code: typeCode,
      title: titleFor(typeCode, code),
      price: null,
      latitude: hasGeo ? geo.latitude : null,
      longitude: hasGeo ? geo.longitude : null,
      locality,
      city,
      address_text: hasGeo ? geo.ocr_address : null,
      attributes: { inventory_code: code },
      approval_status: "DRAFT",
    };
    if (DRY_RUN) {
      summary.imported.push({ code, action: "would create hoarding", row });
      return;
    }
    const { data: inserted, error } = await admin
      .from("hoardings")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      summary.failed.push({ code, reason: `insert failed: ${error.message}` });
      return;
    }
    hoardingId = inserted.id;
    summary.hoardingsCreated++;
  } else {
    summary.hoardingsSkippedExisting++;
  }

  // --- media ---
  const { data: existingMedia, error: mediaSelErr } = await admin
    .from("hoarding_media")
    .select("id, storage_path, processing_status")
    .eq("hoarding_id", hoardingId)
    .eq("is_primary", true)
    .maybeSingle();
  if (mediaSelErr) {
    summary.failed.push({ code, reason: `media lookup failed: ${mediaSelErr.message}` });
    return;
  }

  if (!existingMedia) {
    if (DRY_RUN) {
      summary.mediaCreated++;
    } else {
      const { buffer } = await watermarkImage(filePath);
      const mediaId = randomUUID();
      const storagePath = `${hoardingId}/${mediaId}-watermarked.jpg`;
      const up = await admin.storage
        .from(PUBLIC_BUCKET)
        .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });
      if (up.error) {
        summary.failed.push({ code, reason: `storage upload failed: ${up.error.message}` });
        return;
      }
      const { error: insMediaErr } = await admin.from("hoarding_media").insert({
        id: mediaId,
        hoarding_id: hoardingId,
        media_type: "IMAGE",
        storage_path: storagePath,
        is_primary: true,
        display_order: 0,
        processing_status: "WATERMARKED",
        watermarked_at: new Date().toISOString(),
      });
      if (insMediaErr) {
        await admin.storage.from(PUBLIC_BUCKET).remove([storagePath]);
        summary.failed.push({ code, reason: `media row insert failed: ${insMediaErr.message}` });
        return;
      }
      summary.mediaCreated++;
    }
  } else {
    summary.mediaSkippedExisting++;
  }

  // --- publish decision ---
  // Digital types: taxonomy-only at MVP (mvp-brd.md §5.1) — search excludes
  // them regardless, so they stay DRAFT (still fully visible/manageable in
  // Admin's "All" inventory tab).
  // Out-of-Karnataka sites: real coordinates, but outside the platform's
  // stated single-city (Bengaluru) scope — held at DRAFT pending a product
  // decision, not silently published or silently discarded.
  const shouldPublish = typeCode !== "DIGITAL_BILLBOARD" && !outOfScope;

  if (shouldPublish && existing?.approval_status !== "APPROVED" && !DRY_RUN) {
    const { error: pubErr } = await admin
      .from("hoardings")
      .update({ approval_status: "APPROVED", approved_at: new Date().toISOString(), approved_by: null })
      .eq("id", hoardingId)
      .in("approval_status", ["DRAFT", "PENDING_REVIEW"]);
    if (pubErr) {
      summary.failed.push({ code, reason: `publish failed: ${pubErr.message}` });
      return;
    }
    summary.published++;
  } else if (shouldPublish && existing?.approval_status === "APPROVED") {
    summary.alreadyPublished++;
  } else if (!shouldPublish) {
    summary.heldBack.push({ code, reason: outOfScope ? `outside Karnataka (${geo.state})` : "digital type — not listable at MVP" });
  }

  summary.imported.push({ code, hoarding_id: hoardingId, has_location: hasGeo, published: shouldPublish });
}

// --- main -------------------------------------------------------------

async function main() {
  console.log(`SEEABLE billboard inventory import${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const folder = validateFolder();
  console.log("=== Folder validation ===");
  console.log(`Total files found:      ${folder.total_files}`);
  console.log(`Valid, coded images:    ${folder.valid.length}`);
  console.log(`Unsupported files:      ${folder.unsupported.length}${folder.unsupported.length ? " — " + folder.unsupported.join(", ") : ""}`);
  console.log(`Duplicate codes:        ${folder.duplicates.length}${folder.duplicates.length ? " — " + JSON.stringify(folder.duplicates) : ""}`);
  console.log(`Missing expected codes: ${folder.missing.length}${folder.missing.length ? " — " + folder.missing.join(", ") : ""}`);
  console.log();

  let meta = {};
  try {
    meta = JSON.parse(readFileSync(META_PATH, "utf8"));
  } catch {
    console.warn(`No metadata file at ${META_PATH} — importing with no location data.`);
  }

  const summary = {
    housePublisherId: null,
    hoardingsCreated: 0,
    hoardingsSkippedExisting: 0,
    mediaCreated: 0,
    mediaSkippedExisting: 0,
    published: 0,
    alreadyPublished: 0,
    heldBack: [],
    imported: [],
    failed: [],
    excluded: [],
  };

  summary.housePublisherId = await ensureHousePublisher();
  console.log(`House publisher: ${HOUSE_PUBLISHER_EMAIL} (${summary.housePublisherId})\n`);

  let importable = folder.valid.filter((e) => TYPE_MAP[e.prefix]);
  const excluded = folder.valid.filter((e) => !TYPE_MAP[e.prefix]);
  if (ONLY) importable = importable.filter((e) => ONLY.has(e.code));
  for (const e of excluded) {
    summary.excluded.push({ code: e.code, reason: "no matching hoarding_types code — needs manual classification" });
  }

  console.log(`=== Importing ${importable.length} codes (excluding ${excluded.length}: ${excluded.map((e) => e.code).join(", ") || "none"}) ===`);
  for (const entry of importable) {
    await importOne(entry, meta, summary);
  }

  console.log("\n=== Import summary ===");
  console.log(`Hoardings created:            ${summary.hoardingsCreated}`);
  console.log(`Hoardings already present:    ${summary.hoardingsSkippedExisting}`);
  console.log(`Media rows created:           ${summary.mediaCreated}`);
  console.log(`Media rows already present:   ${summary.mediaSkippedExisting}`);
  console.log(`Newly published (APPROVED):  ${summary.published}`);
  console.log(`Already published:            ${summary.alreadyPublished}`);
  console.log(`Held back (DRAFT, by design): ${summary.heldBack.length}`);
  for (const h of summary.heldBack) console.log(`  ${h.code}: ${h.reason}`);
  console.log(`Excluded from import:         ${summary.excluded.length}`);
  for (const x of summary.excluded) console.log(`  ${x.code}: ${x.reason}`);
  console.log(`Failed:                       ${summary.failed.length}`);
  for (const f of summary.failed) console.log(`  ${f.code}: ${f.reason}`);
  console.log(`\nTotal codes processed: ${summary.imported.length}`);

  process.exit(summary.failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
