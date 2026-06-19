import { Settings, defaultSettings, DragModifier } from "./settings.types";

const SETTINGS_KEY = "app:settings:v2";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem("app:settings:v1");
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return migrateSettings(parsed);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore persistence errors (e.g., private mode)
  }
}

/**
 * Minimal migration/sanitization to guard against missing/invalid fields.
 * Keeps shape stable without an external schema library.
 */
export function migrateSettings(input: any): Settings {
  const out: Settings = {
    difficulty: isDifficulty(input?.difficulty) ? input.difficulty : defaultSettings.difficulty,
    sound: typeof input?.sound === "boolean" ? input.sound : defaultSettings.sound,
    theme: isTheme(input?.theme) ? input.theme : defaultSettings.theme,
    language: isLanguage(input?.language) ? input.language : defaultSettings.language,
    windowDrag: {
      enabled: typeof input?.windowDrag?.enabled === "boolean" ? input.windowDrag.enabled : defaultSettings.windowDrag.enabled,
      viewportDragModifier: isModifier(input?.windowDrag?.viewportDragModifier) ? input.windowDrag.viewportDragModifier : defaultSettings.windowDrag.viewportDragModifier,
      startThresholdPx: toNumberInRange(input?.windowDrag?.startThresholdPx, 0, 32, defaultSettings.windowDrag.startThresholdPx),
      holdToDragMs: toNumberInRange(input?.windowDrag?.holdToDragMs, 0, 1000, defaultSettings.windowDrag.holdToDragMs),
      snapEnabled: typeof input?.windowDrag?.snapEnabled === "boolean" ? input.windowDrag.snapEnabled : defaultSettings.windowDrag.snapEnabled,
      snapThresholdPx: toNumberInRange(input?.windowDrag?.snapThresholdPx, 0, 64, defaultSettings.windowDrag.snapThresholdPx),
      persistPositions: typeof input?.windowDrag?.persistPositions === "boolean" ? input.windowDrag.persistPositions : defaultSettings.windowDrag.persistPositions,
    },
    accessibility: {
      highContrastTargets: typeof input?.accessibility?.highContrastTargets === "boolean" ? input.accessibility.highContrastTargets : defaultSettings.accessibility.highContrastTargets,
      keyboardMoveResize: typeof input?.accessibility?.keyboardMoveResize === "boolean" ? input.accessibility.keyboardMoveResize : defaultSettings.accessibility.keyboardMoveResize,
    },
  };
  return out;
}

function isDifficulty(v: any): v is Settings["difficulty"] {
  return v === "easy" || v === "normal" || v === "hard";
}

function isTheme(v: any): v is Settings["theme"] {
  return v === "light" || v === "dark";
}

function isLanguage(v: any): v is Settings["language"] {
  return v === "pl" || v === "en";
}

function isModifier(v: any): v is DragModifier {
  return v === "none" || v === "alt" || v === "ctrl" || v === "shift" || v === "meta";
}

function toNumberInRange(v: any, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}