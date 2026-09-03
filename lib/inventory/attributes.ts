/**
 * Rendering hints for the data-driven Step-2 fields (docs/04 PB-03 Step 2).
 * The DB only requires each `required_attribute_keys` entry to be present and
 * non-empty (INVENTORY-001) — these helpers just make the inputs friendlier.
 */

const NUMERIC_HINT = /(_ft|_feet|height|width|area|number|count|duration|seconds|resolution)/i;

const ENUMS: Record<string, string[]> = {
  facing_direction: ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"],
  illumination: ["Non-lit", "Frontlit", "Backlit", "Digital"],
  media_position: ["Side", "Rear", "Full wrap", "Roof"],
  wrap_type: ["Full building", "Partial", "Mesh", "Vinyl"],
  confidence_flag: ["LOW", "MEDIUM", "HIGH"],
};

export type AttributeKind =
  | { kind: "number"; suffix?: string }
  | { kind: "select"; options: string[] }
  | { kind: "text" };

export function attributeKind(key: string): AttributeKind {
  if (ENUMS[key]) return { kind: "select", options: ENUMS[key] };
  if (/_ft$|_feet$/.test(key)) return { kind: "number", suffix: "ft" };
  if (NUMERIC_HINT.test(key)) return { kind: "number" };
  return { kind: "text" };
}

/** "height_ft" -> "Height (ft)", "road_name" -> "Road name" */
export function humanizeAttributeKey(key: string): string {
  const kind = attributeKind(key);
  const words = key.replace(/_(ft|feet)$/i, "").split("_").filter(Boolean);
  const label =
    words
      .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ") || key;
  return kind.kind === "number" && kind.suffix
    ? `${label} (${kind.suffix})`
    : label;
}
