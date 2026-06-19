import React, { useMemo, useRef, useState, useEffect } from "react";
import "./desktop.css";
import { useWindowManager } from "@/window/WindowManager";
import { getAppRegistration, getDesktopApps, getWindowDefaults } from "@/window/registry";
import ProgressiveImage from "@/components/ProgressiveImage";

export default function Desktop(): React.ReactElement {
  const { open, handles, focus } = useWindowManager();

  const visibleShortcuts = useMemo(() => getDesktopApps(), []);

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
      title: def.title,
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
              alt="Wallpaper"
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
        className="desktop-grid"
        role="grid"
        aria-label="Desktop icons"
      >
        {visibleShortcuts.map((s, i) => (
          <button
            ref={setIconRef(i)}
            key={s.id}
            className="desktop-icon"
            data-icon={s.icon}
            title={s.title}
            onClick={() => handleOpenById(s.id)}
            role="gridcell"
            aria-label={s.title}
            tabIndex={i === activeIndex ? 0 : -1}
            onKeyDown={(e) => onIconKeyDown(e, i, s.id)}
          >
            <div className="icon-label">{s.title}</div>
          </button>
        ))}
      </div>

      {/* License watermark styled like an inactive Windows notice. */}
      <div className="license-watermark" aria-hidden="true">
        <div>Dors XD isn't activated</div>
        <div>Go to Settings to activate Dors XD.</div>
      </div>

      <div className="taskbar" role="toolbar" aria-label="Taskbar">
        <button className="start-button" title="Start" type="button">⊞</button>
        <div className="taskbar-apps" role="group" aria-label="Open windows">
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
        <div className="system-tray" aria-label="System status">
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
              initialFocusSelector="#ps-name"
            />
          </PlayerSettingsProvider>
        )}
      </React.Suspense>
    </div>
  );
}