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

interface ThemeContextValue {
  /** All themes visible to this user (built-in + published custom) */
  themes: ThemeConfig[];
  /** All themes including unpublished (admin only) */
  allThemes: ThemeConfig[];
  /** Currently active theme */
  activeTheme: ThemeConfig;
  /** Loading state for initial theme fetch */
  loading: boolean;
  /** Set theme for this user (persisted to localStorage) */
  setUserTheme: (themeId: string | null) => void;
  /** Admin: save / create a theme to Firestore */
  saveTheme: (theme: ThemeConfig) => Promise<void>;
  /** Admin: delete a custom theme */
  deleteTheme: (themeId: string) => Promise<void>;
  /** Admin: toggle published state on a theme */
  togglePublished: (themeId: string, published: boolean) => Promise<void>;
}

const defaultTheme = BUILT_IN_THEMES[0]; // dark

const ThemeContext = createContext<ThemeContextValue>({
  themes:      BUILT_IN_THEMES.filter((t) => t.published),
  allThemes:   BUILT_IN_THEMES,
  activeTheme: defaultTheme,
  loading:     true,
  setUserTheme:    () => {},
  saveTheme:       async () => {},
  deleteTheme:     async () => {},
  togglePublished: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFirebaseAuth();
  const [allThemes, setAllThemes] = useState<ThemeConfig[]>(BUILT_IN_THEMES);
  const [localThemeId, setLocalThemeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firestore themes collection in real time
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

  // Resolve standard or local theme from memory
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = user ? `vaultr_theme_${user.uid}` : "vaultr_theme";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalThemeId(localStorage.getItem(storageKey));
  }, [user]);

  // Derived state: activeTheme
  const activeTheme = useMemo(() => {
    if (loading) return defaultTheme;
    const found = localThemeId 
      ? allThemes.find((t) => t.id === localThemeId && (t.published || t.builtIn))
      : null;
    return found ?? defaultTheme;
  }, [allThemes, loading, localThemeId]);

  // Apply to DOM cleanly
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  const setUserTheme = useCallback(
    (themeId: string | null) => {
      const storageKey = user ? `vaultr_theme_${user.uid}` : "vaultr_theme";
      if (!themeId) {
        localStorage.removeItem(storageKey);
        setLocalThemeId(null);
        return;
      }
      const theme = allThemes.find((t) => t.id === themeId);
      if (!theme) return;
      localStorage.setItem(storageKey, themeId);
      setLocalThemeId(themeId);
    },
    [allThemes, user]
  );

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
        loading,
        setUserTheme,
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
