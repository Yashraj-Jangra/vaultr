import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Public-facing MinIO URL used in CSP img-src
    // Use MINIO_PUBLIC_URL if set (production), fall back to MINIO_ENDPOINT (local dev)
    const minioPublicUrl = (
      process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT ?? "http://localhost:9000"
    ).replace(/\/$/, "");

    const csp = [
      "default-src 'self'",
      // Scripts: only self + inline for Next.js hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + data URIs + MinIO public bucket + Google avatar CDN
      `img-src 'self' data: blob: ${minioPublicUrl} https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com`,
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

    const headersList = [
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
    ];

    if (process.env.NODE_ENV === "production") {
      headersList.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/(.*)",
        headers: headersList,
      },
    ];
  },
};

export default nextConfig;

