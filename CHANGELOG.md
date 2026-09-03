# Changelog

## Phase 0 — Project Foundation

- Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui scaffold.
- Supabase clients: server (`@supabase/ssr`), browser, and service-role
  (`admin.ts`, import-restricted via ESLint).
- API foundation: standard response envelope (`{success, data, meta, request_id}`),
  error taxonomy, `route()` wrapper — `api-specification.md` §7/§8.
- `GET /api/health` — bare-JSON uptime probe (§29).
- Design tokens from `docs/02` wired into Tailwind (`app/globals.css`).
- Environment contract: `.env.example`, zod-validated `lib/env.ts` /
  `lib/env.server.ts`.
- OpenNext → Cloudflare adapter (`open-next.config.ts`, `wrangler.jsonc`,
  `cf:*` scripts).
- Supabase project structure (`supabase/config.toml`, `migrations/`, `seed.sql`).
- Testing: Vitest (unit) + Playwright (E2E) with smoke tests.
- CI: GitHub Actions — lint / typecheck / test / build / e2e / Worker bundle size.
- **RISK-1 retired:** skeleton Worker bundle measures ~1.6 MiB gzipped
  (Cloudflare Free ceiling: 3 MiB).

### Pinned deviations from `@latest`

- `typescript` pinned to `6.0.3` — `typescript-eslint` does not support TS 7 yet.
- `eslint` pinned to `^9` — `eslint-plugin-react` (bundled by `eslint-config-next`)
  is not ESLint 10 compatible yet.
