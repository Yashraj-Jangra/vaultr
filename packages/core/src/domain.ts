export const KNOWN_BRANDS: Record<string, string> = {
  // User Requested & High Priority
  supabase: "supabase.com",
  oracle: "oracle.com",
  samsung: "samsung.com",
  unicornstore: "unicornstore.in",
  nvidia: "nvidia.com",
  ea: "ea.com",
  "electronic arts": "ea.com",
  fifa: "ea.com",
  origin: "ea.com",
  teamviewer: "teamviewer.com",
  anydesk: "anydesk.com",
  logmein: "logmein.com",

  // Global & US Banks / Financial Institutions
  chase: "chase.com",
  bankofamerica: "bankofamerica.com",
  bofa: "bankofamerica.com",
  wellsfargo: "wellsfargo.com",
  citibank: "citibank.com",
  citi: "citibank.com",
  capitalone: "capitalone.com",
  usbank: "usbank.com",
  pnc: "pnc.com",
  schwab: "schwab.com",
  fidelity: "fidelity.com",
  vanguard: "vanguard.com",
  etrade: "etrade.com",
  ally: "ally.com",
  discover: "discover.com",
  americanexpress: "americanexpress.com",
  amex: "americanexpress.com",

  // UK, European & International Banks
  hsbc: "hsbc.com",
  barclays: "barclays.com",
  santander: "santander.com",
  bnpparibas: "bnpparibas.com",
  ubs: "ubs.com",
  creditsuisse: "credit-suisse.com",
  monzo: "monzo.com",
  n26: "n26.com",
  starling: "starlingbank.com",
  revolut: "revolut.com",
  wise: "wise.com",

  // Indian Banks & Investment Apps
  hdfc: "hdfcbank.com",
  hdfcbank: "hdfcbank.com",
  icici: "icicibank.com",
  icicibank: "icicibank.com",
  sbi: "sbi.co.in",
  onlinesbi: "sbi.co.in",
  axis: "axisbank.com",
  axisbank: "axisbank.com",
  kotak: "kotak.com",
  kotakbank: "kotak.com",
  indusind: "indusind.com",
  yesbank: "yesbank.in",
  idfc: "idfcfirstbank.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  gpay: "pay.google.com",
  groww: "groww.in",
  zerodha: "zerodha.com",
  kite: "zerodha.com",

  // Major Tech & Hardware Giants
  apple: "apple.com",
  icloud: "apple.com",
  google: "google.com",
  gmail: "gmail.com",
  youtube: "youtube.com",
  microsoft: "microsoft.com",
  outlook: "outlook.com",
  hotmail: "outlook.com",
  amazon: "amazon.com",
  aws: "amazon.com",
  meta: "meta.com",
  facebook: "facebook.com",
  instagram: "instagram.com",
  whatsapp: "whatsapp.com",
  sony: "sony.com",
  amd: "amd.com",
  intel: "intel.com",
  dell: "dell.com",
  hp: "hp.com",
  lenovo: "lenovo.com",
  asus: "asus.com",
  acer: "acer.com",
  logitech: "logitech.com",
  corsair: "corsair.com",
  razer: "razer.com",

  // Cloud, Infrastructure & Hosting
  cloudflare: "cloudflare.com",
  digitalocean: "digitalocean.com",
  linode: "linode.com",
  hetzner: "hetzner.com",
  ovh: "ovh.com",
  scaleway: "scaleway.com",
  heroku: "heroku.com",
  render: "render.com",
  fly: "fly.io",
  vercel: "vercel.com",
  netlify: "netlify.com",
  firebase: "firebase.google.com",
  vultr: "vultr.com",
  backblaze: "backblaze.com",

  // Developer Tools, Package Managers & CI/CD
  github: "github.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
  docker: "docker.com",
  kubernetes: "kubernetes.io",
  npm: "npmjs.com",
  pypi: "pypi.org",
  crates: "crates.io",
  rubygems: "rubygems.org",
  packagist: "packagist.org",
  postman: "postman.com",
  insomnia: "insomnia.rest",
  sentry: "sentry.io",
  datadog: "datadoghq.com",
  hashicorp: "hashicorp.com",
  terraform: "terraform.io",
  grafana: "grafana.com",
  prometheus: "prometheus.io",

  // AI, LLM & Machine Learning
  openai: "openai.com",
  chatgpt: "openai.com",
  anthropic: "anthropic.com",
  claude: "claude.ai",
  perplexity: "perplexity.ai",
  midjourney: "midjourney.com",
  huggingface: "huggingface.co",
  replicate: "replicate.com",
  runway: "runwayml.com",
  deepmind: "deepmind.google",
  cohere: "cohere.com",
  stability: "stability.ai",

  // E-Commerce, Retail & Payments
  stripe: "stripe.com",
  paypal: "paypal.com",
  razorpay: "razorpay.com",
  klarna: "klarna.com",
  square: "squareup.com",
  shopify: "shopify.com",
  ebay: "ebay.com",
  walmart: "walmart.com",
  target: "target.com",
  bestbuy: "bestbuy.com",
  aliexpress: "aliexpress.com",
  alibaba: "alibaba.com",
  etsy: "etsy.com",
  flipkart: "flipkart.com",
  myntra: "myntra.com",
  meesho: "meesho.com",

  // Social Media, Communication & Collaboration
  twitter: "twitter.com",
  x: "x.com",
  linkedin: "linkedin.com",
  reddit: "reddit.com",
  threads: "threads.net",
  pinterest: "pinterest.com",
  snapchat: "snapchat.com",
  tiktok: "tiktok.com",
  mastodon: "mastodon.social",
  bluesky: "bsky.app",
  slack: "slack.com",
  discord: "discord.com",
  telegram: "telegram.org",
  signal: "signal.org",
  zoom: "zoom.us",
  teams: "microsoft.com",

  // Productivity, SaaS & Design
  notion: "notion.so",
  figma: "figma.com",
  linear: "linear.app",
  trello: "trello.com",
  jira: "atlassian.com",
  confluence: "atlassian.com",
  atlassian: "atlassian.com",
  asana: "asana.com",
  monday: "monday.com",
  clickup: "clickup.com",
  airtable: "airtable.com",
  loom: "loom.com",
  miro: "miro.com",
  canva: "canva.com",
  adobe: "adobe.com",
  grammarly: "grammarly.com",
  zoominfo: "zoominfo.com",

  // Media, Streaming & Gaming
  netflix: "netflix.com",
  spotify: "spotify.com",
  hulu: "hulu.com",
  disney: "disneyplus.com",
  hbo: "hbomax.com",
  soundcloud: "soundcloud.com",
  audible: "audible.com",
  twitch: "twitch.tv",
  steam: "steampowered.com",
  epic: "epicgames.com",
  roblox: "roblox.com",
  playstation: "playstation.com",
  xbox: "xbox.com",
  nintendo: "nintendo.com",

  // Password Managers, Privacy & Mail
  vaultr: "vaultr.app",
  bitwarden: "bitwarden.com",
  onepassword: "1password.com",
  lastpass: "lastpass.com",
  dashlane: "dashlane.com",
  proton: "proton.me",
  protonmail: "proton.me",
  fastmail: "fastmail.com",
  zoho: "zoho.com",
  yahoo: "yahoo.com",
  nordvpn: "nordvpn.com",
  expressvpn: "expressvpn.com",
  surfshark: "surfshark.com",
  mullvad: "mullvad.net",

  // Publishing & CMS
  substack: "substack.com",
  medium: "medium.com",
  wordpress: "wordpress.com",
  wix: "wix.com",
  squarespace: "squarespace.com",
  ghost: "ghost.org",

  // Travel & Finance
  uber: "uber.com",
  airbnb: "airbnb.com",
  booking: "booking.com",
  binance: "binance.com",
  coinbase: "coinbase.com",
  kraken: "kraken.com",
};

export function cleanHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "").trim();
}

export function resolveDomain(domain?: string | null, name?: string | null, url?: string | null): string {
  const d = (domain || "").toLowerCase().trim();
  const u = (url || "").toLowerCase().trim();
  const n = (name || "").toLowerCase().trim();

  // 1. Check if domain, url, or name indicates an android app entry (android, androidapp:// or android://)
  const isAndroidEntry =
    d === "android" ||
    d.startsWith("android") ||
    u.startsWith("android") ||
    d.includes("androidapp") ||
    u.includes("androidapp") ||
    n.includes("androidapp") ||
    d.includes("android://") ||
    u.includes("android://") ||
    n.includes("android://");

  if (isAndroidEntry) {
    return "androidapp";
  }

  // 2. Check explicit domain property
  if (d) {
    let target = d;
    if (!target.includes("://")) target = `https://${target}`;
    try {
      const parsed = new URL(target);
      if (parsed.hostname && parsed.hostname.includes(".")) {
        return cleanHostname(parsed.hostname);
      }
    } catch {
      const raw = d.split("/")[0].split(":")[0];
      if (raw.includes(".")) return cleanHostname(raw);
    }
  }

  // 3. Check entry URL property
  if (u) {
    let cleaned = u;
    if (!cleaned.includes("://")) cleaned = `https://${cleaned}`;
    try {
      const parsed = new URL(cleaned);
      if (parsed.hostname && parsed.hostname.includes(".")) {
        return cleanHostname(parsed.hostname);
      }
    } catch {
      /* ignore */
    }
  }

  // 4. Check entry name for domain patterns or brand names
  if (n) {
    if (n.includes(".")) {
      const parts = n.split(/\s+/);
      const withDot = parts.find((p) => p.includes(".") && !p.endsWith("."));
      if (withDot && !withDot.includes("androidapp") && !withDot.includes("android://")) {
        let cleaned = withDot;
        if (!cleaned.includes("://")) cleaned = `https://${cleaned}`;
        try {
          const parsed = new URL(cleaned);
          if (parsed.hostname && parsed.hostname.includes(".")) {
            return cleanHostname(parsed.hostname);
          }
        } catch {
          return cleanHostname(withDot);
        }
      }
    }

    // Match against known brands dictionary
    for (const [brand, domainVal] of Object.entries(KNOWN_BRANDS)) {
      if (n.includes(brand)) return domainVal;
    }
  }

  return "";
}

export function isWebProtocol(protocol?: string): boolean {
  if (!protocol) return false;
  const p = protocol.toLowerCase().trim();
  return p === "http:" || p === "https:" || p === "http" || p === "https";
}

export function isInternalBrowserHost(hostname?: string): boolean {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (!h || h.includes("://")) return true;
  const internalHosts = [
    "newtab",
    "new-tab-page",
    "blank",
    "about",
    "extensions",
    "settings",
    "flags",
    "history",
    "downloads",
    "bookmarks",
  ];
  return internalHosts.includes(h) || h.startsWith("chrome") || h.startsWith("edge");
}

export function isWebPageUrl(rawUrl?: string): boolean {
  if (!rawUrl || !rawUrl.trim()) return false;
  const str = rawUrl.trim().toLowerCase();

  // Explicitly ignore browser internal schemes and non-web protocols
  if (
    str.startsWith("chrome://") ||
    str.startsWith("chrome-extension://") ||
    str.startsWith("edge://") ||
    str.startsWith("about:") ||
    str.startsWith("file://") ||
    str.startsWith("view-source:") ||
    str.startsWith("brave://") ||
    str.startsWith("vivaldi://")
  ) {
    return false;
  }

  if (str.includes("://")) {
    try {
      const parsed = new URL(str);
      if (!isWebProtocol(parsed.protocol)) return false;
      if (isInternalBrowserHost(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }

  return !isInternalBrowserHost(str);
}

/**
 * Detects whether a hostname string is an IPv4 or IPv6 address.
 */
export function isIpAddress(host: string): boolean {
  if (!host) return false;
  const clean = host.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  
  // IPv4 regex (0.0.0.0 to 255.255.255.255)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(clean)) return true;

  // IPv6 detection (contains colons and valid hex chunks or ::)
  if (clean.includes(":") && /^[0-9a-f:]+$/.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Extracts a normalized domain hostname from a raw URL or domain string.
 * Strips scheme, path, query parameters, port numbers, and 'www.' prefixes.
 */
export function extractDomainHost(rawUrlOrDomain?: string): string {
  if (!rawUrlOrDomain || !rawUrlOrDomain.trim()) return "";
  let clean = rawUrlOrDomain.trim().toLowerCase();

  // Filter out internal browser schemes (chrome://, edge://, about:blank, etc.)
  if (
    clean.startsWith("chrome://") ||
    clean.startsWith("chrome-extension://") ||
    clean.startsWith("edge://") ||
    clean.startsWith("about:") ||
    clean.startsWith("file://") ||
    clean.startsWith("view-source:") ||
    clean.startsWith("brave://") ||
    clean.startsWith("vivaldi://")
  ) {
    return "";
  }

  // Bracketed IPv6 (e.g., http://[::1]:8080/path or [::1]:8080)
  const ipv6BracketMatch = clean.match(/\[([0-9a-f:]+)\](?::\d+)?/);
  if (ipv6BracketMatch) {
    return ipv6BracketMatch[1];
  }

  if (clean.includes("://")) {
    try {
      clean = new URL(clean).hostname;
    } catch {
      clean = clean.split("://")[1] || clean;
    }
  }

  // Strip user auth (e.g. user:pass@host)
  if (clean.includes("@")) {
    clean = clean.split("@").pop() || clean;
  }

  // Strip path, query params, hash
  clean = clean.split("/")[0].split("?")[0].split("#")[0];

  // Strip port: if IPv4 or standard hostname (e.g. 192.168.1.50:8080 or example.com:3000)
  clean = clean.split(":")[0];

  // Strip leading www.
  clean = clean.replace(/^www\./, "");

  // Strip trailing dots
  clean = clean.replace(/\.+$/, "");

  if (isInternalBrowserHost(clean)) return "";
  return clean;
}

/** Known two-part public suffixes/ccTLDs where base domain requires 3 parts (e.g. example.co.uk) */
const TWO_PART_CCTLDS = new Set([
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk", "net.uk", "ltd.uk", "plc.uk",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in", "gov.in", "mil.in", "ac.in", "edu.in",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz",
  "co.za", "net.za", "org.za", "gov.za",
  "com.br", "net.br", "org.br", "gov.br",
  "com.mx", "org.mx", "edu.mx", "gob.mx",
  "com.sg", "net.sg", "org.sg", "gov.sg", "edu.sg",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "com.tr", "net.tr", "org.tr", "gov.tr", "edu.tr",
  "com.tw", "net.tw", "org.tw", "gov.tw", "edu.tw",
  "com.hk", "net.hk", "org.hk", "gov.hk", "edu.hk",
  "com.ar", "net.ar", "org.ar", "gov.ar",
  "co.kr", "ne.kr", "re.kr", "go.kr",
  "com.co", "net.co", "nom.co", "co.il", "org.il"
]);

/**
 * Derives the base root domain for a given hostname.
 * - For IP addresses (e.g. 192.168.1.100) or localhost, returns the exact host itself.
 * - For two-part ccTLDs (e.g. login.example.co.uk), returns 'example.co.uk'.
 * - For standard domains (e.g. login.example.com), returns 'example.com'.
 */
export function getBaseRootDomain(hostname: string): string {
  if (!hostname) return "";
  const host = extractDomainHost(hostname);
  if (!host) return "";

  // IP addresses and localhost have no subdomains; the host itself is the root.
  if (isIpAddress(host) || host === "localhost") {
    return host;
  }

  const parts = host.split(".");
  if (parts.length <= 2) return host;

  // Check if last two parts form a known multi-part ccTLD
  const lastTwo = parts.slice(-2).join(".");
  if (TWO_PART_CCTLDS.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

/**
 * Splits a candidate string or array of strings into individual normalized domain or URL tokens.
 * Handles comma, semicolon, newline, and whitespace delimiters, trimming and removing empty entries.
 */
export function splitCandidateUrlsOrDomains(input?: any): string[] {
  if (!input) return [];
  const rawList: any[] = Array.isArray(input) ? input.flat(Infinity) : [input];
  const results: string[] = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== "string") continue;
    const tokens = raw.split(/[\s,;\n\r]+/);
    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed) {
        results.push(trimmed);
      }
    }
  }
  return Array.from(new Set(results));
}

/**
 * Collects and splits all candidate URLs and domains from a vault item and its decrypted payload.
 * Inspects item.domain, item.url, item.urls, item.unencryptedPayload (domain, domains, url, urls),
 * and decrypted payload (domain, domains, url, urls).
 */
export function extractItemCandidateUrls(item: any, decrypted?: any): string[] {
  if (!item) return [];
  const sources: any[] = [];
  if (item.domain) sources.push(item.domain);
  if (item.url) sources.push(item.url);
  if (item.urls) sources.push(item.urls);
  if (item.unencryptedPayload?.domain) sources.push(item.unencryptedPayload.domain);
  if (item.unencryptedPayload?.domains) sources.push(item.unencryptedPayload.domains);
  if (item.unencryptedPayload?.url) sources.push(item.unencryptedPayload.url);
  if (item.unencryptedPayload?.urls) sources.push(item.unencryptedPayload.urls);
  if (decrypted?.domain) sources.push(decrypted.domain);
  if (decrypted?.domains) sources.push(decrypted.domains);
  if (decrypted?.url) sources.push(decrypted.url);
  if (decrypted?.urls) sources.push(decrypted.urls);

  return splitCandidateUrlsOrDomains(sources);
}

/**
 * Calculates a match score between a candidate URL/domain (from vault) and current page host.
 * 
 * Returns:
 * - 3: Exact host match (e.g., 192.168.1.50 == 192.168.1.50 regardless of port, or app.example.com == app.example.com)
 * - 2: Base domain match (saved: example.com, current: abc.example.com) [when allowBaseDomain is true]
 * - 1: Subdomain match (saved: abc.example.com, current: example.com or xyz.example.com) [when allowBaseDomain is true]
 * - 0: No match
 */
export function calculateDomainMatchScore(
  candidateUrlOrDomain: string,
  currentHostOrUrl: string,
  allowBaseDomain: boolean = true
): number {
  if (!candidateUrlOrDomain || !currentHostOrUrl) return 0;

  const candidateHost = extractDomainHost(candidateUrlOrDomain);
  const currentHost = extractDomainHost(currentHostOrUrl);

  if (!candidateHost || !currentHost) return 0;

  // Exact host match (matches across different ports, paths, and protocols, e.g. 192.168.1.100:8080 vs 192.168.1.100:3000, or app.example.com:443 vs app.example.com/login)
  if (candidateHost === currentHost) {
    return 3;
  }

  // IP addresses and localhost never have subdomains/base domains; only exact host matches
  if (isIpAddress(currentHost) || isIpAddress(candidateHost) || currentHost === "localhost" || candidateHost === "localhost") {
    return 0;
  }

  // If base domain matching is turned OFF, require exact host/subdomain match
  if (!allowBaseDomain) {
    return 0;
  }

  const candidateRoot = getBaseRootDomain(candidateHost);
  const currentRoot = getBaseRootDomain(currentHost);

  if (!candidateRoot || !currentRoot) return 0;

  // Candidate is root domain, current page is subdomain (e.g. saved: example.com, current: abc.example.com)
  if (candidateHost === currentRoot) {
    return 2;
  }

  // Root domains match (e.g. saved: abc.example.com, current: example.com or xyz.example.com)
  if (candidateRoot === currentRoot) {
    return 1;
  }

  return 0;
}
