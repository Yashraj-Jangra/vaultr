import { useState, useMemo } from "react";

function resolveDomain(domain?: string, name?: string): string {
  if (domain && domain.trim()) {
    const cleaned = domain.trim().toLowerCase();
    if (cleaned.includes("://")) {
      try { return new URL(cleaned).hostname; } catch { /* ignore */ }
    }
    return cleaned.split("/")[0].split(":")[0];
  }
  if (name && name.trim()) {
    const n = name.trim().toLowerCase();
    if (n.includes(".")) {
      const parts = n.split(/\s+/);
      const withDot = parts.find(p => p.includes(".") && !p.endsWith("."));
      if (withDot) return withDot;
    }
    const knownBrands: Record<string, string> = {
      google: "google.com",
      github: "github.com",
      gitlab: "gitlab.com",
      amazon: "amazon.com",
      aws: "amazon.com",
      netflix: "netflix.com",
      spotify: "spotify.com",
      twitter: "twitter.com",
      x: "x.com",
      facebook: "facebook.com",
      instagram: "instagram.com",
      linkedin: "linkedin.com",
      apple: "apple.com",
      microsoft: "microsoft.com",
      outlook: "outlook.com",
      gmail: "gmail.com",
      chatgpt: "openai.com",
      openai: "openai.com",
      anthropic: "anthropic.com",
      claude: "claude.ai",
      vercel: "vercel.com",
      figma: "figma.com",
      notion: "notion.so",
      slack: "slack.com",
      discord: "discord.com",
      reddit: "reddit.com",
      youtube: "youtube.com",
      dropbox: "dropbox.com",
      steam: "steampowered.com",
      paypal: "paypal.com",
      stripe: "stripe.com",
      bitbucket: "bitbucket.org",
      heroku: "heroku.com",
      render: "render.com",
      fly: "fly.io",
      supabase: "supabase.com",
      firebase: "firebase.google.com",
    };
    for (const [key, val] of Object.entries(knownBrands)) {
      if (n.includes(key)) return val;
    }
  }
  return "";
}

export function SiteIcon({ domain, name, size = 32 }: { domain?: string; name: string; size?: number }) {
  const [errLevel, setErrLevel] = useState(0);
  const effectiveDomain = useMemo(() => resolveDomain(domain, name), [domain, name]);

  const sizeClass = size >= 36 ? "w-9 h-9" : size === 32 ? "w-8 h-8" : "w-7 h-7";
  const textSize = size >= 36 ? "text-[11px]" : "text-[10px]";

  if (!effectiveDomain || errLevel > 2) {
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <span className={`flex items-center justify-center ${sizeClass} shrink-0 bg-neutral-800/80 border border-neutral-700/60 rounded-xl ${textSize} font-semibold text-neutral-300 select-none shadow-sm`}>
        {initials}
      </span>
    );
  }

  // Multi-tier favicon loader:
  // Level 0: Google Favicon API (64px, works on 99.9% of domains)
  // Level 1: DuckDuckGo Favicon API
  // Level 2: Clearbit Logo API
  let src = `https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=64`;
  if (errLevel === 1) {
    src = `https://icons.duckduckgo.com/ip3/${effectiveDomain}.ico`;
  } else if (errLevel === 2) {
    src = `https://logo.clearbit.com/${effectiveDomain}?size=64`;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={effectiveDomain}
      src={src}
      alt=""
      onError={() => setErrLevel(l => l + 1)}
      className={`${sizeClass} shrink-0 rounded-xl object-contain bg-neutral-900 border border-neutral-800 p-1 shadow-sm`}
    />
  );
}
