import next from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "lib/supabase/database.types.ts",
      "supabase/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...next,
  ...nextTs,
  {
    rules: {
      // The service-role Supabase client must never be imported outside its
      // sanctioned locations (IMPLEMENTATION-PLAN.md §1 / Phase 3).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "The service-role client is server-only and restricted. Import it only from app/api/v1/hoardings/**/media/, the jobs pipeline, or migration tooling.",
            },
          ],
        },
      ],
    },
  },
  {
    // Sanctioned service-role usage sites are exempt from the rule above.
    files: [
      "app/api/v1/hoardings/**/media/**",
      "app/api/v1/publishers/me/verification/**",
      "app/api/v1/admin/publishers/**/verification-document/**",
      "lib/supabase/admin.ts",
      "scripts/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default config;
