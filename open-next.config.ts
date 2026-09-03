import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext → Cloudflare adapter config.
 * MVP scale (50–200 listings) needs no incremental cache / tag store /
 * queue overrides — the defaults (in-memory / no-op) are correct here.
 * See https://opennext.js.org/cloudflare/caching if that changes.
 */
export default defineCloudflareConfig({});
