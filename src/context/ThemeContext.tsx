"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  ThemeConfig,
  BUILT_IN_THEMES,
  applyTheme,
} from "@/lib/themes";
import { useAuth } from "@/hooks/useAuth";

export type AppMode = "dark" | "light" | "system";

interface ThemeContextValue {
  themes: ThemeConfig[];
  allThemes: ThemeConfig[];
  activeTheme: ThemeConfig;
  mode: AppMode;
  darkThemeId: string;
  lightThemeId: string;
  loading: boolean;
  setMode: (mode: AppMode) => void;
  setDarkTheme: (themeId: string) => void;
  setLightTheme: (themeId: string) => void;
  saveTheme: (theme: ThemeConfig) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
  togglePublished: (themeId: string, published: boolean) => Promise<void>;
}

const DEFAULT_DARK_ID  = "dark";
const DEFAULT_LIGHT_ID = "light";

const defaultDarkTheme  = BUILT_IN_THEMES.find((t) => t.id === DEFAULT_DARK_ID)!;
const defaultLightTheme = BUILT_IN_THEMES.find((t) => t.id === DEFAULT_LIGHT_ID)!;

const ThemeContext = createContext<ThemeContextValue>({
  themes:       BUILT_IN_THEMES.filter((t) => t.published),
  allThemes:    BUILT_IN_THEMES,
  activeTheme:  defaultDarkTheme,
  mode:         "dark",
  darkThemeId:  DEFAULT_DARK_ID,
  lightThemeId: DEFAULT_LIGHT_ID,
  loading:      true,
  setMode:         () => {},
  setDarkTheme:    () => {},
  setLightTheme:   () => {},
  saveTheme:       async () => {},
  deleteTheme:     async () => {},
  togglePublished: async () => {},
});

function resolveMode(mode: AppMode): "dark" | "light" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [allThemes,    setAllThemes]  = useState<ThemeConfig[]>(BUILT_IN_THEMES);
  const [loading,      setLoading]    = useState(true);
  const [mode,         setModeState]  = useState<AppMode>("dark");
  const [darkThemeId,  setDarkId]     = useState<string>(DEFAULT_DARK_ID);
  const [lightThemeId, setLightId]    = useState<string>(DEFAULT_LIGHT_ID);

  // ── Storage key helpers
  const keys = useMemo(() => {
    const uid = user?.id ?? "guest";
    return {
      mode:  `vaultr_mode_${uid}`,
      dark:  `vaultr_dark_theme_${uid}`,
      light: `vaultr_light_theme_${uid}`,
      old:   user ? `vaultr_theme_${user.id}` : "vaultr_theme",
    };
  }, [user]);

  // ── Read/migrate from localStorage on user change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const oldVal = localStorage.getItem(keys.old);
    if (oldVal) {
      if (oldVal === "light") {
        localStorage.setItem(keys.mode, "light");
      } else {
        localStorage.setItem(keys.mode, "dark");
        if (oldVal !== "dark") localStorage.setItem(keys.dark, oldVal);
      }
      localStorage.removeItem(keys.old);
    }
    const storedMode  = localStorage.getItem(keys.mode) as AppMode | null;
    const storedDark  = localStorage.getItem(keys.dark);
    const storedLight = localStorage.getItem(keys.light);
    setTimeout(() => {
      if (storedMode === "dark" || storedMode === "light" || storedMode === "system") setModeState(storedMode);
      if (storedDark)  setDarkId(storedDark);
      if (storedLight) setLightId(storedLight);
    }, 0);
  }, [keys]);

  // ── Fetch themes from REST API
  useEffect(() => {
    fetch("/api/config/themes", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { themes?: any[] }) => {
        const rawThemes = data.themes ?? [];
        const dbThemes: ThemeConfig[] = rawThemes.map((t) => {
          if (t.data && typeof t.data === "object") {
            return {
              ...t.data,
              id: t.id,
              published: t.published,
              builtIn: t.builtIn,
            };
          }
          return t;
        });
        const dbIds = new Set(dbThemes.map((t) => t.id));
        const merged: ThemeConfig[] = [
          ...BUILT_IN_THEMES.filter((t) => !dbIds.has(t.id)),
          ...dbThemes,
        ].sort((a, b) => {
          if (a.builtIn && !b.builtIn) return -1;
          if (!a.builtIn && b.builtIn) return 1;
          return a.name.localeCompare(b.name);
        });
        setAllThemes(merged);
      })
      .catch(() => {
        // API unavailable — use built-ins only
        setAllThemes(BUILT_IN_THEMES);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Derive activeTheme
  const activeTheme = useMemo(() => {
    if (loading) return defaultDarkTheme;
    const resolved = resolveMode(mode);
    const id = resolved === "dark" ? darkThemeId : lightThemeId;
    const found = allThemes.find((t) => t.id === id && (t.published || t.builtIn));
    return found ?? (resolved === "dark" ? defaultDarkTheme : defaultLightTheme);
  }, [allThemes, loading, mode, darkThemeId, lightThemeId]);

  useEffect(() => { applyTheme(activeTheme); }, [activeTheme]);

  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(activeTheme);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, activeTheme]);

  // ── Public setters
  const setMode = useCallback((newMode: AppMode) => {
    localStorage.setItem(keys.mode, newMode);
    setModeState(newMode);
  }, [keys]);

  const setDarkTheme = useCallback((themeId: string) => {
    if (!allThemes.find((t) => t.id === themeId)) return;
    localStorage.setItem(keys.dark, themeId);
    setDarkId(themeId);
  }, [allThemes, keys]);

  const setLightTheme = useCallback((themeId: string) => {
    if (!allThemes.find((t) => t.id === themeId)) return;
    localStorage.setItem(keys.light, themeId);
    setLightId(themeId);
  }, [allThemes, keys]);

  // ── Admin helpers (REST API calls to /api/config/themes)
  const saveTheme = useCallback(async (theme: ThemeConfig) => {
    await fetch("/api/config/themes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    // Refresh list
    const data = await fetch("/api/config/themes", { credentials: "include" }).then((r) => r.json());
    if (data.themes) {
      const rawThemes = data.themes ?? [];
      const dbThemes: ThemeConfig[] = rawThemes.map((t: any) => {
        if (t.data && typeof t.data === "object") {
          return {
            ...t.data,
            id: t.id,
            published: t.published,
            builtIn: t.builtIn,
          };
        }
        return t;
      });
      const ids = new Set(dbThemes.map((t) => t.id));
      setAllThemes([...BUILT_IN_THEMES.filter((t) => !ids.has(t.id)), ...dbThemes]);
    }
  }, []);

  const deleteTheme = useCallback(async (themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (theme?.builtIn) throw new Error("Cannot delete built-in themes");
    await fetch(`/api/config/themes/${themeId}`, { method: "DELETE", credentials: "include" });
    setAllThemes((prev) => prev.filter((t) => t.id !== themeId));
  }, [allThemes]);

  const togglePublished = useCallback(async (themeId: string, published: boolean) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (!theme || theme.builtIn) return;
    await fetch(`/api/config/themes/${themeId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    setAllThemes((prev) =>
      prev.map((t) => (t.id === themeId ? { ...t, published } : t))
    );
  }, [allThemes]);

  const themes = allThemes.filter((t) => t.published || t.builtIn);

  return (
    <ThemeContext.Provider value={{
      themes, allThemes, activeTheme, mode, darkThemeId, lightThemeId, loading,
      setMode, setDarkTheme, setLightTheme, saveTheme, deleteTheme, togglePublished,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
