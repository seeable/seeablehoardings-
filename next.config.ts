import type { NextConfig } from "next";

// --- Phase 11 · Security headers (api-specification.md §33, IMPLEMENTATION-PLAN.md §Phase 11) ---
// CSP is scoped to what this app actually loads: self-hosted JS/CSS (Next
// build output), self-hosted fonts (next/font/google downloads at build time
// — no runtime fonts.googleapis.com call), the Supabase project (REST +
// Realtime websocket + Storage images), and MapTiler (map style/tiles,
// MapLibre GL JS — free tier, domain-restricted key per README). `blob:` is
// needed for MapLibre's web workers and the client-side watermark canvas
// (`lib/inventory/watermark.ts`) exporting a Blob.
//
// `next dev` needs `'unsafe-eval'` (React Fast Refresh) and a local
// websocket for HMR; neither is present in a production build, so they're
// added only when NODE_ENV === "development".
const isDev = process.env.NODE_ENV === "development";

// script-src 'unsafe-inline': Next.js stamps inline scripts on every page for
// hydration data and streaming — a nonce would remove the need for this, but
// Next's own docs (guides/content-security-policy.md "How nonces work")
// require EVERY page to render dynamically for a nonce to reach those
// scripts, which would force /terms, /privacy, and this app's other static
// routes off Cloudflare's CDN cache. Next's own "Without Nonces" guidance is
// exactly this: 'unsafe-inline' on script-src in next.config, kept static.
// The residual risk is bounded — this codebase has no `dangerouslySetInnerHTML`
// anywhere, so React already escapes all rendered content; connect-src/
// frame-ancestors/object-src below still block exfiltration, clickjacking,
// and plugin-based attacks regardless of this directive.
const scriptSrc = ["'self'", "'unsafe-inline'", isDev && "'unsafe-eval'"]
  .filter(Boolean)
  .join(" ");
const connectSrc = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.maptiler.com",
  "https://*.maptiler.com",
  isDev && "ws://localhost:*",
  isDev && "http://localhost:*",
]
  .filter(Boolean)
  .join(" ");

const CSP = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  // Radix/shadcn primitives (dialogs, popovers, the Calendar) set inline
  // `style="..."` for positioning — CSP has no practical way around this
  // short of a per-request nonce, which needs middleware this app doesn't
  // otherwise require (see lib/supabase/server.ts). Style injection can't
  // execute script, so this is a much smaller concession than script-src.
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.supabase.co https://*.maptiler.com`,
  `font-src 'self' data:`,
  `connect-src ${connectSrc}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // geolocation=(self): the discovery "near me" filter (filter-bar.tsx) asks
  // for it; everything else the platform doesn't use is denied.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't append Next's agent-rules block to CLAUDE.md (that file is
  // developer-owned). Next 16 upgrade notes: node_modules/next/dist/docs/.
  agentRules: false,
  // Supabase Storage public bucket is the only remote image source at MVP.
  // The concrete host is added once the Supabase project URL is known.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// OpenNext Cloudflare dev bindings — only runs in `next dev`, no-op in prod builds.
// See https://opennext.js.org/cloudflare
if (process.env.NODE_ENV === "development") {
  void (async () => {
    try {
      const { initOpenNextCloudflareForDev } =
        await import("@opennextjs/cloudflare");
      await initOpenNextCloudflareForDev();
    } catch {
      // adapter not required for plain `next dev`; ignore if unavailable
    }
  })();
}
