import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads run through a server action, whose request body is capped
    // at 1MB by default — far below the 25MB per-file limit the gallery accepts
    // (and the `photos` bucket allows). Without this, every real phone photo is
    // rejected at the framework boundary before `uploadPhoto` runs. Sized just
    // above 25MB to leave room for multipart boundaries, headers and the caption.
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
  async headers() {
    return [
      {
        // Never let the browser cache the worker itself, so updates ship.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
