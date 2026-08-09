import { useState, useMemo } from "react";
import { resolveDomain } from "@vaultr/core";
import { Globe } from "lucide-react";

export function SiteIcon({
  domain,
  name,
  url,
  size = 36,
}: {
  domain?: string;
  name: string;
  url?: string;
  size?: number;
}) {
  const [hasError, setHasError] = useState(false);
  const effectiveDomain = useMemo(() => resolveDomain(domain, name, url), [domain, name, url]);

  const sizeClass = size >= 40 ? "w-10 h-10" : size >= 32 ? "w-9 h-9" : size >= 24 ? "w-6 h-6" : size >= 20 ? "w-5 h-5" : "w-4 h-4";
  const roundedClass = size >= 32 ? "rounded-xl" : size >= 20 ? "rounded-lg" : "rounded";

  if (!effectiveDomain || hasError) {
    return <Globe className={`${sizeClass} shrink-0 text-neutral-400 select-none`} />;
  }

  const src = `/api/favicon?domain=${encodeURIComponent(effectiveDomain)}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={effectiveDomain}
      src={src}
      alt="Site Icon"
      onError={() => setHasError(true)}
      className={`${sizeClass} shrink-0 ${roundedClass} object-contain select-none`}
    />
  );
}
