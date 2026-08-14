import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const csp = [
      "default-src 'self'",
      // Scripts: only self + inline for Next.js hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com",
      // Images:
      //   'self'                        — avatars via /api/avatars/ proxy (same domain)
      //   data: blob:                   — inline images / canvas
      //   lh[3-6].googleusercontent.com — Google OAuth profile pictures
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com",
      // API / SSE connections + HaveIBeenPwned k-Anonymity API
      "connect-src 'self' https://api.pwnedpasswords.com",
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
  async rewrites() {
    return [
      {
        source: "/vault/generator",
        destination: "/generator",
      },
      {
        source: "/health",
        destination: "/vault/health",
      },
    ];
  },
};

export default nextConfig;

