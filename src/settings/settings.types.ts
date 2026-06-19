import type { Language } from "@/i18n/translations";

export type Difficulty = "easy" | "normal" | "hard";
export type Theme = "light" | "dark";

/** Modifier keys supported for viewport-dragging */
export type DragModifier = "none" | "alt" | "ctrl" | "shift" | "meta";

/** Accessibility preferences for window interactions */
export type AccessibilityPrefs = {
  /** Larger hit targets for resize/drag handles */
  highContrastTargets: boolean;
  /** Enable keyboard move/resize shortcuts */
  keyboardMoveResize: boolean;
};

/** Window dragging and snapping preferences */
export type WindowDragPrefs = {
  /** Master enable/disable for dragging windows */
  enabled: boolean;
  /** Allow dragging from inside window content while holding this modifier */
  viewportDragModifier: DragModifier;
  /** Pixels mouse must move before drag is recognized (prevents accidental drags) */
  startThresholdPx: number;
  /** Optional press-and-hold ms before drag activates (0 disables) */
  holdToDragMs: number;
  /** Enable snapping to screen edges and other windows */
  snapEnabled: boolean;
  /** Snap proximity in pixels */
  snapThresholdPx: number;
  /** Persist window positions between sessions */
  persistPositions: boolean;
};

export type Settings = {
  difficulty: Difficulty;
  sound: boolean;
  theme: Theme;
  language: Language;
  /** New: preferences for window dragging/snapping */
  windowDrag: WindowDragPrefs;
  /** New: accessibility prefs */
  accessibility: AccessibilityPrefs;
};

export const defaultSettings: Settings = {
  difficulty: "normal",
  sound: true,
  theme: "light",
  language: "pl",
  windowDrag: {
    enabled: true,
    viewportDragModifier: "alt",
    startThresholdPx: 4,
    holdToDragMs: 120,
    snapEnabled: true,
    snapThresholdPx: 12,
    persistPositions: true,
  },
  accessibility: {
    highContrastTargets: false,
    keyboardMoveResize: true,
  },
};