import type { ZodError } from "zod";

/**
 * Flatten a ZodError to a `{ pointer: message }` map — api-specification.md §8.2.
 * Every failed field is reported (validation does not stop at the first).
 * Keys use dots for nesting and `[i]` for arrays: `attributes.pole_height`,
 * `blocks[1].end_date`. The root gets `_root`.
 */
export function zodFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    let key = "";
    issue.path.forEach((p, i) => {
      if (typeof p === "number") key += `[${p}]`;
      else key += i === 0 ? String(p) : `.${String(p)}`;
    });
    key = key || "_root";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
