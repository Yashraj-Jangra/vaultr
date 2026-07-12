import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // MinIO endpoint used in CSP img-src (strip trailing slash if present)
    const minioEndpoint = (
      process.env.MINIO_ENDPOINT ?? "http://localhost:9000"
    ).replace(/\/$/, "");

    const csp = [
      "default-src 'self'",
      // Scripts: only self + inline for Next.js hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + data URIs (avatars) + MinIO bucket
      `img-src 'self' data: blob: ${minioEndpoint}`,
      // API / SSE connections
      "connect-src 'self'",
      // Media: none needed
      "media-src 'none'",
      // No iframes
      "frame-src 'none'",
      // No embedding of this page in iframes
      "frame-ancestors 'none'",
      // Form targets: self only
      "form-action 'self'",
      // Base URI: lock to self
      "base-uri 'self'",
      // Object/embed: none
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limit referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Restrict browser feature access
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content Security Policy
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;

