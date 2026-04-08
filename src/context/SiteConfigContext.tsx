"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { SiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/site-config";

interface SiteConfigContextValue {
  config: SiteConfig;
  loading: boolean;
  /** Admin only — persists update to Firestore */
  updateConfig: (patch: Partial<SiteConfig>) => Promise<void>;
}

const SiteConfigContext = createContext<SiteConfigContextValue>({
  config: DEFAULT_SITE_CONFIG,
  loading: true,
  updateConfig: async () => {},
});

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "config", "site");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setConfig({ ...DEFAULT_SITE_CONFIG, ...snap.data() } as SiteConfig);
      }
      setLoading(false);
    }, () => {
      // Firestore unavailable (demo mode / rules block) — use defaults
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateConfig = async (patch: Partial<SiteConfig>) => {
    const ref = doc(db, "config", "site");
    await setDoc(ref, { ...config, ...patch }, { merge: true });
  };

  return (
    <SiteConfigContext.Provider value={{ config, loading, updateConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export const useSiteConfig = () => useContext(SiteConfigContext);
