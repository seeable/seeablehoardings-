"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import * as maplibregl from "maplibre-gl";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";

/**
 * Imports and lightly exercises the four heavy client dependencies so the
 * bundler cannot tree-shake them away — this is what the Phase 0 bundle-size
 * measurement (RISK-1) is measuring against.
 */
const probeSchema = z.object({ ok: z.boolean() });

export function SkeletonProbe() {
  const { formState } = useForm({ defaultValues: { ok: true } });

  const status = useMemo(() => {
    const zodOk = probeSchema.safeParse({ ok: true }).success;
    const maplibreVersion =
      typeof maplibregl.Map === "function" ? maplibregl.getVersion() : "fail";
    const supabase = createClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const supabaseOk = typeof supabase.from === "function";
    return {
      zod: zodOk,
      maplibre: maplibreVersion,
      supabase: supabaseOk,
      rhf: !formState.isSubmitting,
    };
  }, [formState.isSubmitting]);

  const rows: [string, string][] = [
    ["zod", status.zod ? "ok" : "fail"],
    ["maplibre-gl", String(status.maplibre)],
    ["@supabase/supabase-js", status.supabase ? "ok" : "fail"],
    ["react-hook-form", status.rhf ? "ok" : "fail"],
  ];

  return (
    <dl className="border-border bg-surface-1 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 rounded-lg border p-5 text-sm shadow-sm">
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-ink-700">{name}</dt>
          <dd className="text-ink-900 font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
