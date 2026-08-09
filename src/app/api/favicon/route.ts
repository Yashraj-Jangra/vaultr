export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="6" fill="#18181b"/>
  <circle cx="12" cy="12" r="7" stroke="#94a3b8" stroke-width="1.6"/>
  <path d="M12 5a9.5 9.5 0 0 0 0 14 9.5 9.5 0 0 0 0-14" stroke="#94a3b8" stroke-width="1.6"/>
  <path d="M5 12h14" stroke="#94a3b8" stroke-width="1.6"/>
</svg>`;

const GLOBE_RESPONSE = () =>
  new NextResponse(GLOBE_SVG, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });

async function proxyImage(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/124" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 50) return null;
  const ct = res.headers.get("content-type") || "image/png";
  return new NextResponse(buf, {
    headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}

/**
 * GET /api/favicon?domain=github.com
 * Proxies Google Favicon API. For android:// / androidapp:// entries proxies the official Android logo.
 */
export async function GET(req: NextRequest) {
  const domain = new URL(req.url).searchParams.get("domain")?.trim();
  if (!domain) return GLOBE_RESPONSE();

  const d = domain.toLowerCase();

  // Android scheme URIs → official Android Developer head logo
  if (d === "android" || d === "androidapp" || d.startsWith("android:") || d.startsWith("androidapp:")) {
    const res = await proxyImage("https://developer.android.com/static/images/brand/android-head_flat.png");
    return res ?? GLOBE_RESPONSE();
  }

  // Regular web domain → Google Favicon API
  const cleanDomain = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
  if (!cleanDomain) return GLOBE_RESPONSE();

  const res = await proxyImage(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`);
  return res ?? GLOBE_RESPONSE();
}
