import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import "./window.css";
import { WindowErrorBoundary, type WindowErrorBoundaryLabels } from "./WindowErrorBoundary";
import { getAppRegistration, getAppTitleKey, getWindowDefaults } from "./registry";
import { wrapWindowContentWithProviders } from "./windowContentProviders";
import { useTranslation } from "@/i18n/useTranslation";
import { openStandaloneAppWindow } from "./standaloneLaunch";

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

const WindowCtx = createContext<Ctx | undefined>(undefined);
(WindowCtx as unknown as { displayName?: string }).displayName = "WindowCtx";

const MIN_WIDTH_DEFAULT = 520;
const MIN_HEIGHT_DEFAULT = 360;
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 720;
const TASKBAR_HEIGHT = 48;
const VIEWPORT_GAP = 12;

function getViewportRect(): SavedRect {
  if (typeof window === "undefined") {
    return { x: VIEWPORT_GAP, y: VIEWPORT_GAP, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  return {
    x: VIEWPORT_GAP,
    y: VIEWPORT_GAP,
    width: Math.max(280, window.innerWidth - VIEWPORT_GAP * 2),
    height: Math.max(280, window.innerHeight - TASKBAR_HEIGHT - VIEWPORT_GAP * 2),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function fitWindowRect(rect: SavedRect, minWidth: number, minHeight: number): SavedRect {
  const viewport = getViewportRect();
  const width = clamp(rect.width, Math.min(minWidth, viewport.width), viewport.width);
  const height = clamp(rect.height, Math.min(minHeight, viewport.height), viewport.height);

  return {
    x: clamp(rect.x, viewport.x, viewport.x + viewport.width - width),
    y: clamp(rect.y, viewport.y, viewport.y + viewport.height - height),
    width,
    height,
  };
}

export function useWindowManager(): Ctx {
  const ctx = useContext(WindowCtx);
  if (!ctx) throw new Error("useWindowManager must be used within WindowManager");
  return ctx;
}

export function WindowManager({ children }: { children: React.ReactNode }): React.ReactElement {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const zCounter = useRef(1500);
  const { t } = useTranslation();

  const getDisplayTitle = useCallback(
    (id: string, fallback: string) => {
      const titleKey = getAppTitleKey(id);
      return titleKey ? t(titleKey) : fallback;
    },
    [t]
  );

  const open = useCallback((spec: WindowSpec) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === spec.id);
      if (existing) {
        return prev.map((w) =>
          w.id === spec.id ? { ...w, minimized: false, z: ++zCounter.current } : w
        );
      }

      const defaults = getWindowDefaults(spec.id);
      const minWidth = spec.minWidth ?? defaults?.minWidth ?? MIN_WIDTH_DEFAULT;
      const minHeight = spec.minHeight ?? defaults?.minHeight ?? MIN_HEIGHT_DEFAULT;
      const rect = fitWindowRect(
        {
          x: spec.x ?? defaults?.x ?? 100 + Math.floor(Math.random() * 80),
          y: spec.y ?? defaults?.y ?? 60 + Math.floor(Math.random() * 60),
          width: spec.width ?? defaults?.width ?? DEFAULT_WIDTH,
          height: spec.height ?? defaults?.height ?? DEFAULT_HEIGHT,
        },
        minWidth,
        minHeight
      );

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
  }, []);

  const close = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimize = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const focus = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: false, z: ++zCounter.current } : w))
    );
  }, []);

  const maximizeToggle = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;

        if (w.maximized) {
          const saved = w.savedRect ?? { x: 100, y: 60, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
          const rect = fitWindowRect(saved, w.minWidth ?? MIN_WIDTH_DEFAULT, w.minHeight ?? MIN_HEIGHT_DEFAULT);
          return { ...w, ...rect, maximized: false, savedRect: undefined };
        }

        const viewport = getViewportRect();
        return {
          ...w,
          ...viewport,
          maximized: true,
          savedRect: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      })
    );
  }, []);

  const patchWindow = useCallback((id: string, patch: Partial<WindowState>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
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

  return (
    <WindowCtx.Provider value={ctx}>
      {children}
      <div className="wm-root" aria-live="polite">
        {windows.map((w) => (
          <WindowFrame
            key={w.id}
            state={w}
            displayTitle={getDisplayTitle(w.id, w.title)}
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

function WindowFrame(props: {
  state: WindowState;
  displayTitle: string;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onFocus: (id: string) => void;
  onPatch: (patch: Partial<WindowState>) => void;
}): React.ReactElement | null {
  const { state: w, displayTitle } = props;
  const { t } = useTranslation();
  const dragStart = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);

  const errorBoundaryLabels = useMemo<WindowErrorBoundaryLabels>(
    () => ({
      title: t("window.error.title"),
      message: t("window.error.message", { title: displayTitle }),
      close: t("window.error.close"),
      technicalDetails: t("window.error.technicalDetails"),
      errorMessage: t("window.error.errorMessage"),
      stackTrace: t("window.error.stackTrace"),
      componentStack: t("window.error.componentStack"),
    }),
    [displayTitle, t]
  );

  if (w.minimized) return null;

  const onHeaderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (w.maximized || event.button !== 0) return;

    props.onFocus(w.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: w.x,
      y: w.y,
    };
  };

  const onHeaderPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const rect = fitWindowRect(
      {
        x: start.x + event.clientX - start.startX,
        y: start.y + event.clientY - start.startY,
        width: w.width,
        height: w.height,
      },
      w.minWidth ?? MIN_WIDTH_DEFAULT,
      w.minHeight ?? MIN_HEIGHT_DEFAULT
    );

    props.onPatch({ x: rect.x, y: rect.y });
  };

  const onHeaderPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId === event.pointerId) {
      dragStart.current = null;
    }
  };

  const onResizeDown = (event: React.MouseEvent<HTMLDivElement>) => {
    props.onFocus(w.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = w.width;
    const startHeight = w.height;

    const onMove = (moveEvent: MouseEvent) => {
      const rect = fitWindowRect(
        {
          x: w.x,
          y: w.y,
          width: startWidth + moveEvent.clientX - startX,
          height: startHeight + moveEvent.clientY - startY,
        },
        w.minWidth ?? MIN_WIDTH_DEFAULT,
        w.minHeight ?? MIN_HEIGHT_DEFAULT
      );
      props.onPatch({ width: rect.width, height: rect.height });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    event.preventDefault();
  };

  const style: React.CSSProperties = {
    left: w.x,
    top: w.y,
    width: w.width,
    height: w.height,
    zIndex: w.z,
    position: "absolute",
    transform: "translateZ(0)",
    pointerEvents: "auto",
  };

  const maximizeLabel = w.maximized ? t("window.restore") : t("window.maximize");
  const maximizeWindowLabel = w.maximized
    ? t("window.restoreWindow", { title: displayTitle })
    : t("window.maximizeWindow", { title: displayTitle });
  const canOpenStandalone = getAppRegistration(w.id)?.kind === "game";

  return (
    <div
      className="window"
      style={style}
      role="dialog"
      aria-label={displayTitle}
      data-maximized={w.maximized ? "1" : undefined}
    >
      <div
        className="window-header"
        onDoubleClick={() => props.onMaximize(w.id)}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        tabIndex={0}
        aria-roledescription={t("window.titlebarDescription")}
        title={t("window.titlebarTitle")}
      >
        <div className="window-title">{displayTitle}</div>
        <div className="window-controls" onPointerDown={(e) => e.stopPropagation()}>
          {canOpenStandalone && (
            <button
              className="window-control standalone"
              type="button"
              title={t("window.openStandalone")}
              onClick={() => openStandaloneAppWindow(w.id, { width: w.width, height: w.height })}
              aria-label={t("window.openStandaloneWindow", { title: displayTitle })}
            >
              ⛶
            </button>
          )}
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
      <div className="window-content" onPointerDown={() => props.onFocus(w.id)}>
        <WindowErrorBoundary
          labels={errorBoundaryLabels}
          onClose={() => props.onClose(w.id)}
          windowTitle={displayTitle}
        >
          {w.content}
        </WindowErrorBoundary>
      </div>
      {!w.maximized && (
        <div
          className="window-resizer"
          onMouseDown={onResizeDown}
          aria-label={t("window.resize")}
          role="separator"
          title={t("window.resize")}
        />
      )}
    </div>
  );
}
