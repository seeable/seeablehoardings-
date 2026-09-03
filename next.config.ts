import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
