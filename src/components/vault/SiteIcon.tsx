import { useState } from "react";

export function SiteIcon({ domain, name }: { domain?: string; name: string }) {
  const [errLevel, setErrLevel] = useState(0);

  if (!domain || errLevel > 1) {
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <span className="flex items-center justify-center w-7 h-7 shrink-0 bg-neutral-800 border border-[var(--border)] rounded text-[10px] font-bold text-neutral-400 select-none">
        {initials}
      </span>
    );
  }

  // Wow Factor: Use Clearbit for high-quality logos, fallback to Google Favicon
  const src = errLevel === 0 
    ? `https://logo.clearbit.com/${domain}?size=64`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setErrLevel(l => l + 1)}
      className="w-7 h-7 shrink-0 rounded object-contain bg-neutral-800 border border-[var(--border)] p-0.5"
    />
  );
}
