export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="6" fill="#18181b"/>
  <circle cx="12" cy="12" r="7" stroke="#94a3b8" stroke-width="1.6"/>
  <path d="M12 5a9.5 9.5 0 0 0 0 14 9.5 9.5 0 0 0 0-14" stroke="#94a3b8" stroke-width="1.6"/>
  <path d="M5 12h14" stroke="#94a3b8" stroke-width="1.6"/>
</svg>`;

const DEFAULT_ANDROID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="6" fill="#073042"/>
  <path d="M17.5 8a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zm-11 0a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 17.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-8H8v8zm.854-9.354a.5.5 0 0 1 .708 0L10.79 9.37a3.48 3.48 0 0 1 2.42 0l1.228-1.224a.5.5 0 0 1 .708.708l-1.12 1.115A3.49 3.49 0 0 1 15.5 11.5H8.5c0-.585.144-1.137.402-1.621l-1.12-1.115a.5.5 0 0 1 0-.708zM10 10.25a.25.25 0 1 0 0-.5.25.25 0 0 0 0 .5zm4 0a.25.25 0 1 0 0-.5.25.25 0 0 0 0 .5z" fill="#3DDC84"/>
</svg>`;

/**
 * GET /api/favicon?domain=github.com OR GET /api/favicon?domain=android://...
 *
 * Same-origin favicon & Android App icon proxy server.
 * Proxies Google Favicon API server-side & serves vector Android logos for android/androidapp scheme URIs.
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

  // Handle androidapp: / android:// URIs or "android" keyword directly -> Always serve Android Logo
  const lowerDomain = domain.toLowerCase();
  const isAndroid =
    lowerDomain === "android" ||
    lowerDomain.startsWith("android") ||
    lowerDomain.startsWith("androidapp") ||
    lowerDomain.startsWith("android://") ||
    lowerDomain.startsWith("android:");

  if (isAndroid) {
    return new NextResponse(DEFAULT_ANDROID_SVG, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
    });
  }

  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];

  if (!cleanDomain) {
    return new NextResponse(DEFAULT_GLOBE_SVG, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
    });
  }

  const targetUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`;

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
