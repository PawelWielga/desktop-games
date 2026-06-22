import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import "./window.css";
import { useWindowResize } from "./hooks/useWindowResize";
import { getAppTitleKey, getWindowDefaults } from "./registry";
import { wrapWindowContentWithProviders } from "./windowContentProviders";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useSettings } from "@/settings/SettingsContext";
import { useTranslation } from "@/i18n/useTranslation";

/** Public spec for opening a window */
export type WindowSpec = {
  id: string;
  title?: string;
  content: React.ReactNode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

/** Handle summary for taskbar */
export type WindowHandle = {
  id: string;
  title: string;
  minimized: boolean;
};

export type SavedRect = { x: number; y: number; width: number; height: number };

type WindowState = Required<Pick<WindowSpec, "id" | "content">> &
  Omit<WindowSpec, "id" | "content"> & {
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
    minimized: boolean;
    maximized: boolean;
    savedRect?: SavedRect;
  };

type Ctx = {
  windows: WindowState[];
  handles: WindowHandle[];
  open: (spec: WindowSpec) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  maximizeToggle: (id: string) => void;
  focus: (id: string) => void;
};

const MIN_WIDTH_DEFAULT = 520;
const MIN_HEIGHT_DEFAULT = 640;
const KEY_NUDGE_STEP = 10;
const FALLBACK_VIEWPORT_WIDTH = 960;
const FALLBACK_VIEWPORT_HEIGHT = 720;
const MIN_USABLE_VIEWPORT_SIZE = 280;

type UsableViewportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  margin: number;
};

type ResponsiveRectInput = {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  x: number;
  y: number;
};

type ResponsiveRect = SavedRect & {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
};

// Stable context for devtools; avoid redundant redefinition
const WindowCtx = createContext<Ctx | undefined>(undefined);
(WindowCtx as unknown as { displayName?: string }).displayName = "WindowCtx";

/**
 * Custom hook to access WindowManager context.
 * Keep as a stable named function (not reassigned) for Fast Refresh.
 */
export function useWindowManager(): Ctx {
  const ctx = useContext(WindowCtx);
  if (!ctx) throw new Error("useWindowManager must be used within WindowManager");
  return ctx;
}

function readCssNumber(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;

  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getUsableViewportBounds(): UsableViewportBounds {
  if (typeof window === "undefined") {
    return {
      x: 0,
      y: 0,
      width: FALLBACK_VIEWPORT_WIDTH,
      height: FALLBACK_VIEWPORT_HEIGHT,
      margin: 0,
    };
  }

  const margin = Math.round(readCssNumber("--window-viewport-gap", 12));
  const taskbarHeight = Math.round(readCssNumber("--taskbar-height", 48));

  return {
    x: margin,
    y: margin,
    width: Math.max(MIN_USABLE_VIEWPORT_SIZE, window.innerWidth - margin * 2),
    height: Math.max(MIN_USABLE_VIEWPORT_SIZE, window.innerHeight - taskbarHeight - margin * 2),
    margin,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function fitWindowToViewport(input: ResponsiveRectInput): ResponsiveRect {
  const bounds = getUsableViewportBounds();
  const maxWidth = Math.max(1, Math.min(input.maxWidth ?? bounds.width, bounds.width));
  const maxHeight = Math.max(1, Math.min(input.maxHeight ?? bounds.height, bounds.height));
  const minWidth = Math.min(input.minWidth, maxWidth);
  const minHeight = Math.min(input.minHeight, maxHeight);
  const width = Math.round(clampNumber(input.width, minWidth, maxWidth));
  const height = Math.round(clampNumber(input.height, minHeight, maxHeight));
  const x = Math.round(clampNumber(input.x, bounds.x, bounds.x + bounds.width - width));
  const y = Math.round(clampNumber(input.y, bounds.y, bounds.y + bounds.height - height));

  return { x, y, width, height, minWidth, minHeight, maxWidth, maxHeight };
}

function hasPositionPatch(patch: Partial<WindowState>): boolean {
  return "x" in patch || "y" in patch;
}

function persistWindowPosition(id: string, x: number, y: number): void {
  try {
    localStorage.setItem(`wm:pos:${id}`, JSON.stringify({ x, y }));
  } catch {}
}

/**
 * Provider component for window management.
 * Keep as a stable named function export for Fast Refresh.
 */
export function WindowManager({ children }: { children: React.ReactNode }): React.ReactElement {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const windowsRef = useRef<WindowState[]>([]);
  const zCounter = useRef(1500);
  const { settings } = useSettings();
  const { t } = useTranslation();

  const getDisplayTitle = useCallback(
    (id: string, fallback: string) => {
      const titleKey = getAppTitleKey(id);
      return titleKey ? t(titleKey) : fallback;
    },
    [t]
  );

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  const open = useCallback((spec: WindowSpec) => {
    setWindows((prev) => {
      const exist = prev.find((w) => w.id === spec.id);
      if (exist) {
        // unminimize and focus
        return prev.map((w) =>
          w.id === spec.id ? { ...w, minimized: false, z: ++zCounter.current } : w
        );
      }

      // Resolve defaults from registry if present
      const defaults = getWindowDefaults(spec.id);

      const width = spec.width ?? defaults?.width ?? 960;
      const height = spec.height ?? defaults?.height ?? 720;
      const minWidth = spec.minWidth ?? defaults?.minWidth ?? MIN_WIDTH_DEFAULT;
      const minHeight = spec.minHeight ?? defaults?.minHeight ?? MIN_HEIGHT_DEFAULT;

      const readPersistedPosition = (axis: "x" | "y"): number | undefined => {
        if (!settings.windowDrag.persistPositions) return undefined;

        try {
          const raw = localStorage.getItem(`wm:pos:${spec.id}`);
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          return typeof parsed?.[axis] === "number" ? (parsed[axis] as number) : undefined;
        } catch {
          return undefined;
        }
      };

      const x = readPersistedPosition("x") ?? spec.x ?? defaults?.x ?? 100 + Math.floor(Math.random() * 80);
      const y = readPersistedPosition("y") ?? spec.y ?? defaults?.y ?? 60 + Math.floor(Math.random() * 60);
      const rect = fitWindowToViewport({
        width,
        height,
        minWidth,
        minHeight,
        maxWidth: spec.maxWidth ?? defaults?.maxWidth,
        maxHeight: spec.maxHeight ?? defaults?.maxHeight,
        x,
        y,
      });

      const next: WindowState = {
        id: spec.id,
        content: wrapWindowContentWithProviders(spec.id, spec.content),
        title: spec.title ?? defaults?.title ?? spec.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        minWidth,
        minHeight,
        maxWidth: spec.maxWidth ?? defaults?.maxWidth ?? undefined,
        maxHeight: spec.maxHeight ?? defaults?.maxHeight ?? undefined,
        z: ++zCounter.current,
        minimized: false,
        maximized: false,
      };
      return [...prev, next];
    });
  }, [settings.windowDrag.persistPositions]);

  const close = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimize = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: true } : w))
    );
  }, []);

  const maximizeToggle = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          const saved = w.savedRect;
          if (saved) {
            const rect = fitWindowToViewport({
              ...saved,
              minWidth: w.minWidth ?? MIN_WIDTH_DEFAULT,
              minHeight: w.minHeight ?? MIN_HEIGHT_DEFAULT,
              maxWidth: w.maxWidth,
              maxHeight: w.maxHeight,
            });

            return {
              ...w,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              maximized: false,
              savedRect: undefined,
            };
          }
          return { ...w, maximized: false, savedRect: undefined };
        } else {
          const savedRect: SavedRect = {
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
          };
          const bounds = getUsableViewportBounds();
          return {
            ...w,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            maximized: true,
            savedRect,
          };
        }
      })
    );
  }, []);

  const focus = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, z: ++zCounter.current, minimized: false } : w
      )
    );
  }, []);

  const patchWindow = useCallback((id: string, patch: Partial<WindowState>) => {
    if (settings.windowDrag.persistPositions && hasPositionPatch(patch)) {
      const current = windowsRef.current.find((w) => w.id === id);
      const nextX = typeof patch.x === "number" ? patch.x : current?.x;
      const nextY = typeof patch.y === "number" ? patch.y : current?.y;
      if (typeof nextX === "number" && typeof nextY === "number") {
        persistWindowPosition(id, nextX, nextY);
      }
    }

    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  }, [settings.windowDrag.persistPositions]);

  useEffect(() => {
    const onResize = () => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.maximized) {
            const bounds = getUsableViewportBounds();
            return { ...w, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          }

          const rect = fitWindowToViewport({
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
            minWidth: w.minWidth ?? MIN_WIDTH_DEFAULT,
            minHeight: w.minHeight ?? MIN_HEIGHT_DEFAULT,
            maxWidth: w.maxWidth,
            maxHeight: w.maxHeight,
          });

          return { ...w, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        })
      );
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({
      windows,
      handles: windows.map((w) => ({
        id: w.id,
        title: getDisplayTitle(w.id, w.title),
        minimized: w.minimized,
      })),
      open,
      close,
      minimize,
      maximizeToggle,
      focus,
    }),
    [windows, getDisplayTitle, open, close, minimize, maximizeToggle, focus]
  );

  // Global keyboard shortcuts for focused window
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Determine top-most non-minimized window as active
      const active = [...windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];
      if (!active) return;

      // ESC minimize
      if (e.key === "Escape") {
        minimize(active.id);
        return;
      }
      // Alt+Enter toggle maximize
      if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        maximizeToggle(active.id);
        return;
      }
      // Shift+Arrow nudge
      if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        setWindows((prev) =>
          prev.map((w) => {
            if (w.id !== active.id || w.maximized) return w;
            const dx =
              e.key === "ArrowRight" ? KEY_NUDGE_STEP : e.key === "ArrowLeft" ? -KEY_NUDGE_STEP : 0;
            const dy =
              e.key === "ArrowDown" ? KEY_NUDGE_STEP : e.key === "ArrowUp" ? -KEY_NUDGE_STEP : 0;
            const bounds = getUsableViewportBounds();
            const nx = clampNumber(w.x + dx, bounds.x, bounds.x + bounds.width - w.width);
            const ny = clampNumber(w.y + dy, bounds.y, bounds.y + bounds.height - w.height);
            return { ...w, x: nx, y: ny };
          })
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windows, minimize, maximizeToggle]);

  return (
    <WindowCtx.Provider value={ctx}>
      {children}
      <div className="wm-root" aria-live="polite">
        {windows.map((w, _i, arr) => (
          <WindowFrame
            key={w.id}
            state={w}
            displayTitle={getDisplayTitle(w.id, w.title)}
            topMostId={[...arr].filter((x) => !x.minimized).sort((a, b) => b.z - a.z)[0]?.id}
            onClose={close}
            onMinimize={minimize}
            onMaximize={maximizeToggle}
            onFocus={focus}
            onPatch={(patch) => patchWindow(w.id, patch)}
          />
        ))}
      </div>
    </WindowCtx.Provider>
  );
}

/**
 * Internal presentational component for a single window frame.
 * Declared as a function to keep export surface consistent.
 */
function WindowFrame(props: {
  state: WindowState;
  displayTitle: string;
  topMostId?: string;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onFocus: (id: string) => void;
  onPatch: (patch: Partial<WindowState>) => void;
}): React.ReactElement | null {
  const { state: w, displayTitle } = props;
  const { t } = useTranslation();

  // Derive viewport-aware constraints
  const bounds = getUsableViewportBounds();
  const minWidth = Math.min(w.minWidth ?? MIN_WIDTH_DEFAULT, bounds.width);
  const minHeight = Math.min(w.minHeight ?? MIN_HEIGHT_DEFAULT, bounds.height);
  const maxWidth = Math.min(w.maxWidth ?? bounds.width, Math.max(minWidth, bounds.x + bounds.width - w.x));
  const maxHeight = Math.min(w.maxHeight ?? bounds.height, Math.max(minHeight, bounds.y + bounds.height - w.y));

  // Resize hook (kept)
  const resize = useWindowResize(
    (patch) => props.onPatch(patch),
    { minWidth, minHeight, maxWidth, maxHeight }
  );

  useEffect(() => () => resize.onCleanup(), [resize]);

  // Dragging
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);

  const setHeaderRef = useCallback((node: HTMLDivElement | null) => {
    headerRef.current = node;
    setHeaderEl(node);
  }, []);

  const setContentRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    setContentEl(node);
  }, []);

  // Bind drag behavior
  useWindowDrag(
    (p) => props.onPatch(p),
    () => ({
      id: w.id,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      maximized: w.maximized,
    }),
    { headerEl, contentEl }
  );

  const onResizeDown = (e: React.MouseEvent) => {
    props.onFocus(w.id);
    resize.onMouseDown(e, { width: w.width, height: w.height });
    e.preventDefault();
  };

  if (w.minimized) return null;

  const style: React.CSSProperties = {
    left: w.x,
    top: w.y,
    width: w.width,
    height: w.height,
    zIndex: w.z,
    position: "absolute",
    transform: "translateZ(0)",
    pointerEvents: "auto"
  };

  const ariaModal = props.topMostId === w.id && w.maximized;
  const maximizeLabel = w.maximized ? t("window.restore") : t("window.maximize");
  const maximizeWindowLabel = w.maximized
    ? t("window.restoreWindow", { title: displayTitle })
    : t("window.maximizeWindow", { title: displayTitle });

  return (
    <div
      className="window"
      style={style}
      role="dialog"
      aria-label={displayTitle}
      aria-modal={ariaModal || undefined}
      data-maximized={w.maximized ? "1" : undefined}
    >
      <div
        className="window-header"
        ref={setHeaderRef}
        onDoubleClick={() => props.onMaximize(w.id)}
        tabIndex={0}
        aria-roledescription={t("window.titlebarDescription")}
        title={t("window.titlebarTitle")}
        onPointerDown={() => {
          // Ensure window is focused before drag so z-index applies to the active window
          props.onFocus(w.id);
        }}
      >
        <div className="window-title">{displayTitle}</div>
        {/* Prevent drags starting on control buttons from bubbling to header */}
        <div
          className="window-controls"
          onPointerDown={(e) => {
            // Stop header drag initiation when pressing buttons
            e.stopPropagation();
          }}
        >
          <button
            className="window-control"
            type="button"
            title={t("window.minimize")}
            onClick={() => props.onMinimize(w.id)}
            aria-label={t("window.minimizeWindow", { title: displayTitle })}
          >
            −
          </button>
          <button
            className="window-control"
            type="button"
            title={maximizeLabel}
            onClick={() => props.onMaximize(w.id)}
            aria-pressed={w.maximized}
            aria-label={maximizeWindowLabel}
          >
            □
          </button>
          <button
            className="window-control close"
            type="button"
            title={t("window.close")}
            onClick={() => props.onClose(w.id)}
            aria-label={t("window.closeWindow", { title: displayTitle })}
          >
            ×
          </button>
        </div>
      </div>
      <div
        className="window-content"
        ref={setContentRef}
        onPointerDown={() => {
          // Also focus when starting content-modifier drags on first interaction
          props.onFocus(w.id);
        }}
      >
        {w.content}
      </div>
      {
        !w.maximized && (
          <div
            className="window-resizer"
            onMouseDown={onResizeDown}
            aria-label={t("window.resize")}
            role="separator"
            title={t("window.resize")}
          />
        )
      }
    </div>
  );
}

// Utility placeholder retained intentionally for future feature work
function isTopMost(_w: WindowState): boolean {
  return false;
}
