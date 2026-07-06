// Site configuration stored in PostgreSQL under config_site
// Admin can update these values from the admin panel

export interface SiteConfig {
  name: string;          // "_vaultr"
  tagline: string;       // "Zero-knowledge password manager"
  logoUrl?: string;      // optional custom logo URL
  supportEmail?: string;
  githubUrl?: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  cardBins?: { prefix: string; brand: string }[];
  cardEasterEggs?: string[];
  vaultDialogLayout?: "split" | "bento";
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  name: "_vaultr",
  tagline: "Zero-knowledge password manager",
  maintenanceMode: false,
  vaultDialogLayout: "split",
  cardBins: [
    { prefix: "4", brand: "Visa" },
    { prefix: "51", brand: "Mastercard" },
    { prefix: "52", brand: "Mastercard" },
    { prefix: "53", brand: "Mastercard" },
    { prefix: "54", brand: "Mastercard" },
    { prefix: "55", brand: "Mastercard" },
    { prefix: "2221", brand: "Mastercard" },
    { prefix: "34", brand: "AMEX" },
    { prefix: "37", brand: "AMEX" },
    { prefix: "6011", brand: "Discover" },
    { prefix: "65", brand: "Discover" },
    { prefix: "644", brand: "Discover" },
    { prefix: "60", brand: "RuPay" },
    { prefix: "6521", brand: "RuPay" },
    { prefix: "81", brand: "RuPay" }
  ],
  cardEasterEggs: [
    "NOPE", "BRUH", "OOPS", "VOID", "LMAO", "FAKECARD", "UH-OH",
    "MYSTERYCARD", "GUESSWORK", "WHATEVERCARD", "ANXIETY EXPRESS", "ALIEN EXPRESS"
  ],
};
