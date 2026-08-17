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
