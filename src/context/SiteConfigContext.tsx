"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/site-config";

interface SiteConfigContextValue {
  config: SiteConfig;
  loading: boolean;
  /** Admin only — persists update to PostgreSQL via API */
  updateConfig: (patch: Partial<SiteConfig>) => Promise<void>;
}

const SiteConfigContext = createContext<SiteConfigContextValue>({
  config: DEFAULT_SITE_CONFIG,
  loading: true,
  updateConfig: async () => {},
});

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig]   = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState(true);

  // Initial fetch from REST API
  useEffect(() => {
    fetch("/api/config/site", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.config) setConfig({ ...DEFAULT_SITE_CONFIG, ...data.config });
      })
      .catch(() => { /* use defaults on error */ })
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = async (patch: Partial<SiteConfig>) => {
    const newConfig = { ...config, ...patch };
    setConfig(newConfig); // optimistic
    await fetch("/api/config/site", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: newConfig }),
    });
  };

  return (
    <SiteConfigContext.Provider value={{ config, loading, updateConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export const useSiteConfig = () => useContext(SiteConfigContext);
