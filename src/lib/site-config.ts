// Site configuration stored in Firestore under config/site
// Admin can update these values from the admin panel

export interface SiteConfig {
  name: string;          // "_vaultr"
  tagline: string;       // "Zero-knowledge password manager"
  logoUrl?: string;      // optional custom logo URL
  supportEmail?: string;
  githubUrl?: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  name: "_vaultr",
  tagline: "Zero-knowledge password manager",
  maintenanceMode: false,
};
