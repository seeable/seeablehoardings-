"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  attributeKind,
  humanizeAttributeKey,
} from "@/lib/inventory/attributes";

export type AttributeValues = Record<string, string | number | boolean | null>;

/**
 * PB-03 Step 2 dynamic fields — one input per key in the type's
 * `required_attribute_keys` (api-specification.md §11.5). All required for
 * submission (INVENTORY-001); `missing` flags which are still blank.
 */
export function AttributeFields({
  keys,
  values,
  onChange,
  missing = [],
}: {
  keys: string[];
  values: AttributeValues;
  onChange: (next: AttributeValues) => void;
  missing?: string[];
}) {
  if (keys.length === 0) return null;
  const set = (k: string, v: string) =>
    onChange({ ...values, [k]: v === "" ? null : v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {keys.map((k) => {
        const kind = attributeKind(k);
        const raw = values[k];
        const strVal = raw == null ? "" : String(raw);
        const err = missing.includes(k) ? "Required for this hoarding type" : undefined;
        return (
          <Field key={k} label={humanizeAttributeKey(k)} htmlFor={`attr-${k}`} error={err} required>
            {kind.kind === "select" ? (
              <Select
                value={strVal}
                placeholder="Select…"
                invalid={!!err}
                onChange={(e) => set(k, e.target.value)}
              >
                {kind.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type={kind.kind === "number" ? "number" : "text"}
                inputMode={kind.kind === "number" ? "decimal" : undefined}
                value={strVal}
                invalid={!!err}
                onChange={(e) => set(k, e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
