import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Settings } from "./settings.types";
import { defaultSettings } from "./settings.types";
import { loadSettings, saveSettings } from "./settings.storage";

/** Public API for settings context */
type SettingsContextValue = {
  settings: Settings;
  setDifficulty: (d: Settings["difficulty"]) => void;
  toggleSound: () => void;
  setTheme: (t: Settings["theme"]) => void;
  setLanguage: (language: Settings["language"]) => void;
  reset: () => void;
};

/** Internal React Context for app settings */
const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

/** Provider that loads, persists, and exposes app settings */
export function SettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  // Persist settings and reflect theme on document element
  useEffect(() => {
    saveSettings(settings);
    try {
      document.documentElement.dataset.theme = settings.theme;
      document.documentElement.lang = settings.language;
    } catch {
      // Ignore DOM write issues (e.g., SSR or restricted environments)
    }
  }, [settings]);

  const api = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setDifficulty: (d) => setSettings((s) => ({ ...s, difficulty: d })),
      toggleSound: () => setSettings((s) => ({ ...s, sound: !s.sound })),
      setTheme: (t) => setSettings((s) => ({ ...s, theme: t })),
      setLanguage: (language) => setSettings((s) => ({ ...s, language })),
      reset: () => setSettings(defaultSettings),
    }),
    [settings]
  );

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

/** Hook to access settings safely within provider */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}