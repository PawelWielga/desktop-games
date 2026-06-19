import React, { useEffect, useMemo, useRef, useState } from "react";
import "./desktop.css";
import { useWindowManager } from "@/window/WindowManager";
import { getAppRegistration, getDesktopApps, getWindowDefaults } from "@/window/registry";
import ProgressiveImage from "@/components/ProgressiveImage";
import { useTranslation } from "@/i18n/useTranslation";

type DesktopIconPosition = {
  column: number;
  row: number;
};

type DesktopIconLayout = Record<string, DesktopIconPosition>;

type GridMetrics = {
  paddingLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  iconColumn: number;
  iconRow: number;
  gapX: number;
  gapY: number;
  viewportWidth: number;
  viewportHeight: number;
};

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  hasMoved: boolean;
  left: number;
  top: number;
};

const DESKTOP_ICON_LAYOUT_STORAGE_KEY = "desktop.iconLayout.v1";
const DRAG_THRESHOLD_PX = 4;

const parseCssPixels = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseFirstCssPixel = (value: string): number => parseCssPixels(value.split(" ")[0] ?? "");

const getIconPositionKey = ({ column, row }: DesktopIconPosition): string => `${column}:${row}`;

const findFirstFreeIconPosition = (occupiedPositions: ReadonlySet<string>): DesktopIconPosition => {
  for (let row = 0; row <= occupiedPositions.size; row += 1) {
    const position = { column: 0, row };
    if (!occupiedPositions.has(getIconPositionKey(position))) return position;
  }

  return { column: 0, row: occupiedPositions.size };
};

const isIconPosition = (value: unknown): value is DesktopIconPosition => {
  if (!value || typeof value !== "object") return false;

  const { column, row } = value as Partial<DesktopIconPosition>;
  return Number.isInteger(column) && Number.isInteger(row) && typeof column === "number" && typeof row === "number" && column >= 0 && row >= 0;
};

const readStoredLayout = (): DesktopIconLayout => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(DESKTOP_ICON_LAYOUT_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<DesktopIconLayout>((layout, [id, position]) => {
      if (isIconPosition(position)) layout[id] = position;
      return layout;
    }, {});
  } catch {
    return {};
  }
};

const mergeLayoutWithVisibleApps = (storedLayout: DesktopIconLayout, appIds: string[]): DesktopIconLayout => {
  const usedPositions = new Set<string>();

  return appIds.reduce<DesktopIconLayout>((layout, id) => {
    const storedPosition = storedLayout[id];
    const position =
      storedPosition && !usedPositions.has(getIconPositionKey(storedPosition))
        ? storedPosition
        : findFirstFreeIconPosition(usedPositions);

    layout[id] = position;
    usedPositions.add(getIconPositionKey(position));
    return layout;
  }, {});
};

const getGridMetrics = (gridElement: HTMLDivElement): GridMetrics => {
  const styles = window.getComputedStyle(gridElement);
  const rect = gridElement.getBoundingClientRect();
  const iconElement = gridElement.querySelector<HTMLButtonElement>(".desktop-icon");
  const iconRect = iconElement?.getBoundingClientRect();

  return {
    paddingLeft: parseCssPixels(styles.paddingLeft),
    paddingTop: parseCssPixels(styles.paddingTop),
    paddingRight: parseCssPixels(styles.paddingRight),
    paddingBottom: parseCssPixels(styles.paddingBottom),
    iconColumn: parseFirstCssPixel(styles.gridTemplateColumns) || iconRect?.width || 0,
    iconRow: parseCssPixels(styles.gridAutoRows) || iconRect?.height || 0,
    gapX: parseCssPixels(styles.columnGap),
    gapY: parseCssPixels(styles.rowGap),
    viewportWidth: rect.width,
    viewportHeight: rect.height,
  };
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const getMaxGridPosition = (metrics: GridMetrics): DesktopIconPosition => ({
  column: Math.max(0, Math.floor((metrics.viewportWidth - metrics.paddingLeft - metrics.paddingRight - metrics.iconColumn) / (metrics.iconColumn + metrics.gapX))),
  row: Math.max(0, Math.floor((metrics.viewportHeight - metrics.paddingTop - metrics.paddingBottom - metrics.iconRow) / (metrics.iconRow + metrics.gapY))),
});

const getSnappedPosition = (left: number, top: number, metrics: GridMetrics): DesktopIconPosition => {
  const maxPosition = getMaxGridPosition(metrics);

  return {
    column: clamp(Math.round((left - metrics.paddingLeft) / (metrics.iconColumn + metrics.gapX)), 0, maxPosition.column),
    row: clamp(Math.round((top - metrics.paddingTop) / (metrics.iconRow + metrics.gapY)), 0, maxPosition.row),
  };
};

const applyDropPosition = (layout: DesktopIconLayout, draggedId: string, nextPosition: DesktopIconPosition): DesktopIconLayout => {
  const previousPosition = layout[draggedId];
  const occupyingEntry = Object.entries(layout).find(
    ([id, position]) => id !== draggedId && position.column === nextPosition.column && position.row === nextPosition.row
  );

  const nextLayout = { ...layout, [draggedId]: nextPosition };

  if (occupyingEntry && previousPosition) {
    const [occupyingId] = occupyingEntry;
    nextLayout[occupyingId] = previousPosition;
  }

  return nextLayout;
};

export default function Desktop(): React.ReactElement {
  const { open, handles, focus } = useWindowManager();
  const { t } = useTranslation();

  const visibleShortcuts = useMemo(() => getDesktopApps(), []);
  const visibleShortcutIds = useMemo(() => visibleShortcuts.map((shortcut) => shortcut.id), [visibleShortcuts]);

  const [iconLayout, setIconLayout] = useState<DesktopIconLayout>(() =>
    mergeLayoutWithVisibleApps(readStoredLayout(), visibleShortcutIds)
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIconLayout((currentLayout) => mergeLayoutWithVisibleApps(currentLayout, visibleShortcutIds));
  }, [visibleShortcutIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DESKTOP_ICON_LAYOUT_STORAGE_KEY, JSON.stringify(iconLayout));
  }, [iconLayout]);

  const [showSettings, setShowSettings] = useState(false);

  const handleOpenById = async (id: string): Promise<void> => {
    const app = getAppRegistration(id);
    if (!app?.implemented) return;

    if (app.kind === "system") {
      if (app.id === "settings") setShowSettings(true);
      return;
    }

    const def = getWindowDefaults(id);
    if (!def) return;
    // Lazy-load component
    const mod = await def.loader();
    const Content = mod.default as React.ComponentType;
    open({
      id: def.id,
      title: t(def.titleKey ?? app.titleKey),
      content: <Content />,
      width: def.width,
      height: def.height,
      x: def.x,
      y: def.y,
      minWidth: def.minWidth,
      minHeight: def.minHeight,
      maxWidth: def.maxWidth,
      maxHeight: def.maxHeight,
    });
  };

  const finishIconDrag = (state: DragState): void => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    const metrics = getGridMetrics(gridElement);
    const nextPosition = getSnappedPosition(state.left, state.top, metrics);
    setIconLayout((currentLayout) => applyDropPosition(currentLayout, state.id, nextPosition));
  };

  const updateIconDrag = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState || currentDragState.pointerId !== e.pointerId) return;

    const gridElement = gridRef.current;
    if (!gridElement) return;

    const gridRect = gridElement.getBoundingClientRect();
    const metrics = getGridMetrics(gridElement);
    const maxLeft = metrics.viewportWidth - metrics.paddingRight - metrics.iconColumn;
    const maxTop = metrics.viewportHeight - metrics.paddingBottom - metrics.iconRow;
    const deltaX = Math.abs(e.clientX - currentDragState.startX);
    const deltaY = Math.abs(e.clientY - currentDragState.startY);
    const hasMoved = currentDragState.hasMoved || deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX;

    const nextDragState: DragState = {
      ...currentDragState,
      hasMoved,
      left: clamp(e.clientX - gridRect.left - currentDragState.offsetX, metrics.paddingLeft, maxLeft),
      top: clamp(e.clientY - gridRect.top - currentDragState.offsetY, metrics.paddingTop, maxTop),
    };

    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  };

  const endIconDrag = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState || currentDragState.pointerId !== e.pointerId) return;

    if (currentDragState.hasMoved) {
      finishIconDrag(currentDragState);
      suppressNextClickRef.current = true;
    }

    dragStateRef.current = null;
    setDragState(null);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onIconPointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string): void => {
    if (e.button !== 0) return;

    const gridElement = gridRef.current;
    if (!gridElement) return;

    const gridRect = gridElement.getBoundingClientRect();
    const iconRect = e.currentTarget.getBoundingClientRect();
    const nextDragState: DragState = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - iconRect.left,
      offsetY: e.clientY - iconRect.top,
      hasMoved: false,
      left: iconRect.left - gridRect.left,
      top: iconRect.top - gridRect.top,
    };

    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onIconClick = (id: string): void => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    handleOpenById(id);
  };

  // Accessibility: roving tabindex over desktop icons
  const [activeIndex, setActiveIndex] = useState(0);
  const iconRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (delta: number) => {
    if (visibleShortcuts.length === 0) return;
    const next = (activeIndex + delta + visibleShortcuts.length) % visibleShortcuts.length;
    setActiveIndex(next);
    const el = iconRefs.current[next];
    el?.focus();
  };

  const onIconKeyDown = (e: React.KeyboardEvent, idx: number, id: string) => {
    // Set current index when any keydown occurs on that icon
    if (activeIndex !== idx) setActiveIndex(idx);

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        handleOpenById(id);
        break;
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        iconRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(visibleShortcuts.length - 1);
        iconRefs.current[visibleShortcuts.length - 1]?.focus();
        break;
    }
  };

  // Taskbar keyboard navigation
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const taskRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveTaskFocus = (delta: number) => {
    if (handles.length === 0) return;
    const next = (activeTaskIndex + delta + handles.length) % handles.length;
    setActiveTaskIndex(next);
    taskRefs.current[next]?.focus();
  };

  const onTaskKeyDown = (e: React.KeyboardEvent, idx: number, id: string) => {
    if (activeTaskIndex !== idx) setActiveTaskIndex(idx);
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        focus(id);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveTaskFocus(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveTaskFocus(-1);
        break;
      case "Home":
        e.preventDefault();
        setActiveTaskIndex(0);
        taskRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        setActiveTaskIndex(Math.max(0, handles.length - 1));
        taskRefs.current[Math.max(0, handles.length - 1)]?.focus();
        break;
    }
  };

  // Stable callback refs to satisfy TS Ref signature (must return void)
  const setIconRef = (i: number) => (el: HTMLButtonElement | null): void => {
    iconRefs.current[i] = el;
  };
  const setTaskRef = (i: number) => (el: HTMLButtonElement | null): void => {
    taskRefs.current[i] = el;
  };

  // Lazy-load settings panel and provider chunk (single definition)
  const PlayerSettingsPanel = React.useMemo(
    () => React.lazy(() => import("@/settings/player/PlayerSettingsPanel")),
    []
  );
  const [PlayerSettingsProvider, setPlayerSettingsProvider] =
    useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);
  useEffect(() => {
    let mounted = true;
    import("@/settings/player/PlayerSettingsContext").then((mod) => {
      if (mounted) setPlayerSettingsProvider(() => mod.PlayerSettingsProvider as React.ComponentType<{ children: React.ReactNode }>);
    });
    return () => {
      mounted = false;
    };
  }, []);

 return (
   <div className="desktop-root">
      {/* Wallpaper layer */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} aria-hidden>
        {(() => {
          // Use Vite's base path; fallback to "/"
          const base: string = (import.meta as any).env?.BASE_URL ?? "/";
          const low = `${base}wallpapers/forest_low.jpg`;
          const hi = `${base}wallpapers/forest.jpg`;
          return (
            <ProgressiveImage
              lowSrc={low}
              src={hi}
              alt={t("desktop.wallpaperAlt")}
              // Longer, smoother transition + subtle zoom
              crossfadeMs={1800}
              blurPreview={true}
              preserveAspectRatio={false}
              zoomOnReveal={true}
              blurUnwind={true}
            />
          );
        })()}
      </div>

      {/* Foreground grid */}
      <div
        ref={gridRef}
        className="desktop-grid"
        role="grid"
        aria-label={t("desktop.iconsAria")}
      >
        {visibleShortcuts.map((s, i) => {
          const position = iconLayout[s.id] ?? { column: 0, row: i };
          const isDragging = dragState?.id === s.id && dragState.hasMoved;
          const title = t(s.titleKey);
          const style: React.CSSProperties = isDragging
            ? { left: dragState.left, top: dragState.top }
            : { gridColumn: position.column + 1, gridRow: position.row + 1 };

          return (
            <button
              ref={setIconRef(i)}
              key={s.id}
              className={`desktop-icon${isDragging ? " is-dragging" : ""}`}
              data-icon={s.icon}
              data-has-icon-asset={s.iconAsset ? "true" : undefined}
              title={title}
              style={style}
              onClick={() => onIconClick(s.id)}
              onPointerDown={(e) => onIconPointerDown(e, s.id)}
              onPointerMove={updateIconDrag}
              onPointerUp={endIconDrag}
              onPointerCancel={endIconDrag}
              role="gridcell"
              aria-label={title}
              aria-grabbed={isDragging}
              tabIndex={i === activeIndex ? 0 : -1}
              onKeyDown={(e) => onIconKeyDown(e, i, s.id)}
              type="button"
            >
              {s.iconAsset && (
                <img className="desktop-icon__asset" src={s.iconAsset} alt="" aria-hidden="true" />
              )}
              <div className="icon-label">{title}</div>
            </button>
          );
        })}
      </div>

      {/* License watermark styled like an inactive Windows notice. */}
      <div className="license-watermark" aria-hidden="true">
        <div>{t("desktop.watermark.line1")}</div>
        <div>{t("desktop.watermark.line2")}</div>
      </div>

      <div className="taskbar" role="toolbar" aria-label={t("desktop.taskbarAria")}>
        <button className="start-button" title="Start" type="button">⊞</button>
        <div className="taskbar-apps" role="group" aria-label={t("desktop.openWindowsAria")}>
          {handles.map((h, i) => (
            <button
              ref={setTaskRef(i)}
              key={h.id}
              className="taskbar-btn"
              onClick={() => focus(h.id)}
              title={h.title}
              aria-pressed={!h.minimized}
              tabIndex={i === activeTaskIndex ? 0 : -1}
              onKeyDown={(e) => onTaskKeyDown(e, i, h.id)}
              type="button"
            >
              {h.title}
            </button>
          ))}
        </div>
        <div className="system-tray" aria-label={t("desktop.systemStatusAria")}>
          <span aria-hidden>🔊</span>
          <span aria-hidden>📶</span>
          <span id="clock" className="clock" />
        </div>
      </div>

      {/* Settings modal portal-like render above taskbar */}
      <React.Suspense fallback={null}>
        {PlayerSettingsProvider && (
          <PlayerSettingsProvider>
            <PlayerSettingsPanel
              open={showSettings}
              onClose={() => setShowSettings(false)}
              variant={window.innerWidth <= 640 ? "drawer" : "modal"}
              initialFocusSelector="#ps-language"
            />
          </PlayerSettingsProvider>
        )}
      </React.Suspense>
    </div>
  );
}
