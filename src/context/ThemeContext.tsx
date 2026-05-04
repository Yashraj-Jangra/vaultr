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
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  ThemeConfig,
  BUILT_IN_THEMES,
  applyTheme,
} from "@/lib/themes";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";

export type AppMode = "dark" | "light" | "system";

interface ThemeContextValue {
  /** All themes visible to this user (built-in + published custom) */
  themes: ThemeConfig[];
  /** All themes including unpublished (admin only) */
  allThemes: ThemeConfig[];
  /** Currently active theme (derived from mode + selected slot) */
  activeTheme: ThemeConfig;
  /** Current user mode preference */
  mode: AppMode;
  /** ID of the theme selected for the dark slot */
  darkThemeId: string;
  /** ID of the theme selected for the light slot */
  lightThemeId: string;
  /** Loading state for initial theme fetch */
  loading: boolean;
  /** Switch active mode */
  setMode: (mode: AppMode) => void;
  /** Set the dark-slot theme */
  setDarkTheme: (themeId: string) => void;
  /** Set the light-slot theme */
  setLightTheme: (themeId: string) => void;
  /** Admin: save / create a theme to Firestore */
  saveTheme: (theme: ThemeConfig) => Promise<void>;
  /** Admin: delete a custom theme */
  deleteTheme: (themeId: string) => Promise<void>;
  /** Admin: toggle published state on a theme */
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

/** Detect the actual resolved mode when app mode is "system" */
function resolveMode(mode: AppMode): "dark" | "light" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFirebaseAuth();
  const [allThemes, setAllThemes]     = useState<ThemeConfig[]>(BUILT_IN_THEMES);
  const [loading, setLoading]         = useState(true);
  const [mode, setModeState]          = useState<AppMode>("dark");
  const [darkThemeId, setDarkId]      = useState<string>(DEFAULT_DARK_ID);
  const [lightThemeId, setLightId]    = useState<string>(DEFAULT_LIGHT_ID);

  // ── Storage key helpers ────────────────────────────────────────────────
  const keys = useMemo(() => {
    const uid = user?.uid ?? "guest";
    return {
      mode:  `vaultr_mode_${uid}`,
      dark:  `vaultr_dark_theme_${uid}`,
      light: `vaultr_light_theme_${uid}`,
      // legacy key for migration
      old:   user ? `vaultr_theme_${user.uid}` : "vaultr_theme",
    };
  }, [user]);

  // ── Read/migrate from localStorage on user change ─────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Migrate old single-key storage
    const oldVal = localStorage.getItem(keys.old);
    if (oldVal) {
      if (oldVal === "light") {
        localStorage.setItem(keys.mode, "light");
      } else {
        localStorage.setItem(keys.mode, "dark");
        if (oldVal !== "dark") {
          localStorage.setItem(keys.dark, oldVal);
        }
      }
      localStorage.removeItem(keys.old);
    }

    const storedMode  = localStorage.getItem(keys.mode) as AppMode | null;
    const storedDark  = localStorage.getItem(keys.dark);
    const storedLight = localStorage.getItem(keys.light);

    if (storedMode === "dark" || storedMode === "light" || storedMode === "system") {
      setModeState(storedMode);
    }
    if (storedDark)  setDarkId(storedDark);
    if (storedLight) setLightId(storedLight);
  }, [keys]);

  // ── Subscribe to Firestore themes collection ──────────────────────────
  useEffect(() => {
    const ref = collection(db, "config", "themes", "list");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const firestoreThemes: ThemeConfig[] = snap.docs.map(
          (d) => d.data() as ThemeConfig
        );
        // Merge: Firestore wins over built-ins with the same id
        const firestoreIds = new Set(firestoreThemes.map((t) => t.id));
        const merged = [
          ...BUILT_IN_THEMES.filter((t) => !firestoreIds.has(t.id)),
          ...firestoreThemes,
        ].sort((a, b) => {
          if (a.builtIn && !b.builtIn) return -1;
          if (!a.builtIn && b.builtIn) return 1;
          return a.name.localeCompare(b.name);
        });
        setAllThemes(merged);
        setLoading(false);
      },
      () => {
        // Firestore unavailable — use built-ins
        setAllThemes(BUILT_IN_THEMES);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Derive activeTheme ────────────────────────────────────────────────
  const activeTheme = useMemo(() => {
    if (loading) return defaultDarkTheme;
    const resolved = resolveMode(mode);
    const id = resolved === "dark" ? darkThemeId : lightThemeId;
    const found = allThemes.find(
      (t) => t.id === id && (t.published || t.builtIn)
    );
    return found ?? (resolved === "dark" ? defaultDarkTheme : defaultLightTheme);
  }, [allThemes, loading, mode, darkThemeId, lightThemeId]);

  // ── Apply theme to DOM ────────────────────────────────────────────────
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  // ── Listen for OS color-scheme changes when mode === "system" ─────────
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(activeTheme); // re-derive via useMemo trigger
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, activeTheme]);

  // ── Public setters ────────────────────────────────────────────────────
  const setMode = useCallback((newMode: AppMode) => {
    localStorage.setItem(keys.mode, newMode);
    setModeState(newMode);
  }, [keys]);

  const setDarkTheme = useCallback((themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (!theme) return;
    localStorage.setItem(keys.dark, themeId);
    setDarkId(themeId);
  }, [allThemes, keys]);

  const setLightTheme = useCallback((themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (!theme) return;
    localStorage.setItem(keys.light, themeId);
    setLightId(themeId);
  }, [allThemes, keys]);

  // ── Admin helpers ─────────────────────────────────────────────────────
  const saveTheme = useCallback(async (theme: ThemeConfig) => {
    const ref = doc(db, "config", "themes", "list", theme.id);
    await setDoc(ref, { ...theme, createdAt: theme.createdAt ?? serverTimestamp() });
  }, []);

  const deleteTheme = useCallback(async (themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (theme?.builtIn) throw new Error("Cannot delete built-in themes");
    const ref = doc(db, "config", "themes", "list", themeId);
    await deleteDoc(ref);
  }, [allThemes]);

  const togglePublished = useCallback(
    async (themeId: string, published: boolean) => {
      const theme = allThemes.find((t) => t.id === themeId);
      if (!theme) return;
      if (theme.builtIn) return; // built-ins are always published
      const ref = doc(db, "config", "themes", "list", themeId);
      await setDoc(ref, { ...theme, published }, { merge: true });
    },
    [allThemes]
  );

  const themes = allThemes.filter((t) => t.published || t.builtIn);

  return (
    <ThemeContext.Provider
      value={{
        themes,
        allThemes,
        activeTheme,
        mode,
        darkThemeId,
        lightThemeId,
        loading,
        setMode,
        setDarkTheme,
        setLightTheme,
        saveTheme,
        deleteTheme,
        togglePublished,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
