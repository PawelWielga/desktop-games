import { useEffect, useRef } from "react";
import { isFullscreen } from "@/utils/fullscreen";
import { useSettings } from "@/settings/SettingsContext";

/**
 * useWindowDrag()
 * Pointer-driven window dragging with optional hold-to-drag and start threshold,
 * titlebar or modifier-in-viewport drag, edge/window snapping, and rAF updates.
 *
 * Usage:
 *   const drag = useWindowDrag(patch, () => ({ id, x, y, width, height, maximized }), { headerEl, contentEl });
 *   - Attach headerEl to the title bar element (always draggable)
 *   - Optionally attach contentEl to enable viewport dragging when modifier is held
 */
export function useWindowDrag(
  patch: (p: { x?: number; y?: number }) => void,
  getState: () => { id: string; x: number; y: number; width: number; height: number; maximized: boolean },
  opts?: { headerEl?: HTMLElement | null; contentEl?: HTMLElement | null }
): void {
  const { settings } = useSettings();
  const patchRef = useRef(patch);
  const getStateRef = useRef(getState);
  const dragActive = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const lastFrame = useRef(0);
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  patchRef.current = patch;
  getStateRef.current = getState;

  const threshold = Math.max(0, settings.windowDrag.startThresholdPx);
  const holdMs = Math.max(0, settings.windowDrag.holdToDragMs);
  const snapEnabled = settings.windowDrag.snapEnabled;
  const snapThreshold = Math.max(0, settings.windowDrag.snapThresholdPx);
  const allowViewportDrag = settings.windowDrag.viewportDragModifier !== "none";

  function isModifierHeld(e: MouseEvent | PointerEvent): boolean {
    switch (settings.windowDrag.viewportDragModifier) {
      case "alt":
        return (e as MouseEvent).altKey;
      case "ctrl":
        return (e as MouseEvent).ctrlKey;
      case "shift":
        return (e as MouseEvent).shiftKey;
      case "meta":
        return (e as MouseEvent).metaKey;
      case "none":
      default:
        return false;
    }
  }

  function clampToViewport(nx: number, ny: number, w: number, h: number) {
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return { x: Math.min(maxX, Math.max(0, nx)), y: Math.min(maxY, Math.max(0, ny)) };
  }

  function applySnap(nx: number, ny: number, w: number, h: number) {
    if (!snapEnabled) return { x: nx, y: ny };
    let sx = nx;
    let sy = ny;

    // Snap to viewport edges
    if (Math.abs(nx - 0) <= snapThreshold) sx = 0;
    if (Math.abs(ny - 0) <= snapThreshold) sy = 0;
    const rightGap = window.innerWidth - (nx + w);
    const bottomGap = window.innerHeight - (ny + h);
    if (Math.abs(rightGap) <= snapThreshold) sx = window.innerWidth - w;
    if (Math.abs(bottomGap) <= snapThreshold) sy = window.innerHeight - h;

    // Snap to other windows (query by class). Use bounding rects in CSS pixels.
    const rectA = { x: sx, y: sy, w, h };
    const others = Array.from(document.querySelectorAll<HTMLElement>(".window"));

    for (const el of others) {
      const r = el.getBoundingClientRect();
      const edges = {
        left: r.left,
        right: r.left + r.width,
        top: r.top,
        bottom: r.top + r.height,
      };

      // Horizontal snaps
      if (Math.abs(rectA.x - edges.right) <= snapThreshold && rectOverlap1D(rectA.y, rectA.h, edges.top, r.height)) {
        sx = edges.right;
      }
      if (Math.abs(rectA.x + rectA.w - edges.left) <= snapThreshold && rectOverlap1D(rectA.y, rectA.h, edges.top, r.height)) {
        sx = edges.left - rectA.w;
      }
      // Vertical snaps
      if (Math.abs(rectA.y - edges.bottom) <= snapThreshold && rectOverlap1D(rectA.x, rectA.w, edges.left, r.width)) {
        sy = edges.bottom;
      }
      if (Math.abs(rectA.y + rectA.h - edges.top) <= snapThreshold && rectOverlap1D(rectA.x, rectA.w, edges.left, r.width)) {
        sy = edges.top - rectA.h;
      }
    }

    return { x: sx, y: sy };
  }

  function rectOverlap1D(aStart: number, aLen: number, bStart: number, bLen: number): boolean {
    const aEnd = aStart + aLen;
    const bEnd = bStart + bLen;
    return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
  }

  function schedulePatch(x: number, y: number) {
    pendingPos.current = { x, y };
    if (!lastFrame.current) {
      lastFrame.current = requestAnimationFrame(() => {
        lastFrame.current = 0;
        const p = pendingPos.current;
        if (p) {
          patchRef.current({ x: p.x, y: p.y });
        }
      });
    }
  }

  function startDrag(e: PointerEvent) {
    const st = getStateRef.current();
    if (st.maximized || !settings.windowDrag.enabled || isFullscreen()) return;

    // Prevent text selection and focus flicker
    try { (e.target as HTMLElement)?.focus?.(); } catch {}
    if (typeof (e as any).preventDefault === "function") (e as any).preventDefault();

    startPoint.current = { x: e.clientX, y: e.clientY };
    startPos.current = { x: st.x, y: st.y };
    dragActive.current = false;

    // Hold-to-drag support
    if (holdMs > 0) {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        dragActive.current = true;
        holdTimer.current = null;
      }, holdMs) as unknown as number;
    }

    // capture on the header root if available to keep events even when leaving element
    try {
      (opts?.headerEl ?? (e.target as Element))?.setPointerCapture?.(e.pointerId);
    } catch {}
    // Add non-passive move listener so preventDefault is honored during drag
    window.addEventListener("pointermove", onMove as any, { passive: false } as AddEventListenerOptions);
    window.addEventListener("pointerup", onUp as any, { passive: true } as AddEventListenerOptions);
    window.addEventListener("pointercancel", onUp as any, { passive: true } as AddEventListenerOptions);
  }

  function onMove(e: PointerEvent) {
    // Prevent text selection/scroll during drag
    if (typeof (e as any).preventDefault === "function") (e as any).preventDefault();

    const st = getStateRef.current();
    if (st.maximized) return;

    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;

    // Activate after threshold if not hold-armed
    if (!dragActive.current) {
      if (holdMs === 0 && (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold)) {
        dragActive.current = true;
      } else if (holdMs > 0 && holdTimer.current === null) {
        // hold elapsed -> active
        dragActive.current = true;
      } else {
        return;
      }
    }

    const nx = startPos.current.x + dx;
    const ny = startPos.current.y + dy;

    const clamped = clampToViewport(nx, ny, st.width, st.height);
    const snapped = applySnap(clamped.x, clamped.y, st.width, st.height);
    schedulePatch(snapped.x, snapped.y);
  }

  function onUp(_e: PointerEvent) {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    window.removeEventListener("pointermove", onMove as any);
    window.removeEventListener("pointerup", onUp as any);
    window.removeEventListener("pointercancel", onUp as any);
    dragActive.current = false;
    pendingPos.current = null;
    if (lastFrame.current) {
      cancelAnimationFrame(lastFrame.current);
      lastFrame.current = 0;
    }
  }

  // Attach to header (always)
  useEffect(() => {
    // Attach immediately; if ref becomes non-null later, effect re-runs
    const header = opts?.headerEl ?? null;
    if (!header) return;

    // Prevent text selection and ensure consistent cursor behavior
    try { header.style.userSelect = "none"; } catch {}

    const down = (e: PointerEvent) => {
      // Only primary button drags
      if (e.button !== 0) return;

      // Synthesize focus/z-index raise before initiating drag to avoid "second click" requirement
      try {
        // Focus the header for a11y, but do not scroll
        (header as HTMLElement).focus?.({ preventScroll: true } as any);
      } catch {}
      // Prevent default to block text selection and click-through oddities
      if (typeof (e as any).preventDefault === "function") (e as any).preventDefault();

      // Avoid starting drag when pressing interactive control inside header
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("button") || target.closest("a") || target.closest('[role="button"]'))) {
        return;
      }

      startDrag(e);
    };

    // Use non-passive so preventDefault is honored and we can start capture synchronously
    header.addEventListener("pointerdown", down as any, { passive: false } as AddEventListenerOptions);
    return () => header.removeEventListener("pointerdown", down as any);
  }, [
    opts?.headerEl,
    settings.windowDrag.enabled,
    settings.windowDrag.startThresholdPx,
    settings.windowDrag.holdToDragMs,
    settings.windowDrag.snapEnabled,
    settings.windowDrag.snapThresholdPx,
  ]);

  // Attach to content for modifier-based dragging
  useEffect(() => {
    if (!allowViewportDrag) return;
    const content = opts?.contentEl ?? null;
    if (!content) return;

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!isModifierHeld(e)) return;

      // Focus window content quickly to promote z-index and avoid "second click"
      try { (content as HTMLElement).focus?.({ preventScroll: true } as any); } catch {}
      if (typeof (e as any).preventDefault === "function") (e as any).preventDefault();

      startDrag(e);
    };

    content.addEventListener("pointerdown", down as any, { passive: false } as AddEventListenerOptions);
    return () => content.removeEventListener("pointerdown", down as any);
  }, [opts?.contentEl, allowViewportDrag, settings.windowDrag.viewportDragModifier]);
}
