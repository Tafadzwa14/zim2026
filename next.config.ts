import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// A stable ID for each deployed build lets Next.js detect a resumed tab that
// belongs to an older deployment and hard-reload it before RSC/action payloads
// from different builds can be mixed. Vercel and GitHub provide commit SHAs;
// other hosts can set NEXT_DEPLOYMENT_ID during the build.
const rawDeploymentId =
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA;
// Vercel caps custom skew-protection IDs at 32 characters, while Git SHAs
// contain 40. The leading 32 characters remain deterministic per build.
const deploymentId = rawDeploymentId?.slice(0, 32);
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  deploymentId,
  experimental: {
    // Photo uploads run through a server action, whose request body is capped
    // at 1MB by default — far below the 50MB per-file limit the gallery accepts
    // (and the `photos` bucket allows). Without this, every real phone photo is
    // rejected at the framework boundary before `uploadPhoto` runs. Sized just
    // above 50MB to leave room for multipart boundaries, headers and the caption.
    serverActions: {
      bodySizeLimit: "51mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
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
