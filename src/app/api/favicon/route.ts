export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="6" fill="#18181b"/>
  <circle cx="12" cy="12" r="7" stroke="#94a3b8" stroke-width="1.6"/>
  <path d="M12 5a9.5 9.5 0 0 0 0 14 9.5 9.5 0 0 0 0-14" stroke="#94a3b8" stroke-width="1.6"/>
  <path d="M5 12h14" stroke="#94a3b8" stroke-width="1.6"/>
</svg>`;

const OFFICIAL_ANDROID_LOGO_URL = "https://developer.android.com/static/images/brand/android-head_flat.png";

/**
 * GET /api/favicon?domain=github.com OR GET /api/favicon?domain=androidapp
 *
 * Same-origin favicon & Android App icon proxy server.
 * Proxies Google Favicon API & Android Developer brand logos server-side.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain")?.trim();

  if (!domain) {
    return new NextResponse(DEFAULT_GLOBE_SVG, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
    });
  }

  // Handle android / androidapp scheme URIs
  const lowerDomain = domain.toLowerCase();
  const isAndroid =
    lowerDomain === "android" ||
    lowerDomain.startsWith("android") ||
    lowerDomain.startsWith("androidapp") ||
    lowerDomain.startsWith("android://") ||
    lowerDomain.startsWith("android:");

  const cleanDomain = !isAndroid
    ? domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0]
    : "";

  if (!cleanDomain && !isAndroid) {
    return new NextResponse(DEFAULT_GLOBE_SVG, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
    });
  }

  const targetUrl = isAndroid
    ? OFFICIAL_ANDROID_LOGO_URL
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "image/png";
      const buffer = await res.arrayBuffer();

      if (buffer.byteLength > 50) {
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }
    }
  } catch {
    /* fallback to SVG Globe */
  }

  return new NextResponse(DEFAULT_GLOBE_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
