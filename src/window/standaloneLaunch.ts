import { getAppRegistration, getWindowDefaults } from "./registry";

const FALLBACK_WINDOW_WIDTH = 1280;
const FALLBACK_WINDOW_HEIGHT = 800;
const MIN_STANDALONE_WIDTH = 640;
const MIN_STANDALONE_HEIGHT = 480;

function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === "./") return "/";

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function clampWindowSize(value: number, min: number, available: number, fallback: number): number {
  if (!Number.isFinite(value)) return Math.min(fallback, available);
  return Math.max(min, Math.min(Math.round(value), available));
}

export function canOpenStandaloneApp(id: string): boolean {
  const app = getAppRegistration(id);
  return Boolean(app?.implemented && app.kind === "game" && app.window);
}

export function getStandaloneAppUrl(id: string): string {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL);
  return new URL(`${basePath}${encodeURIComponent(id)}`, window.location.origin).toString();
}

export function openStandaloneAppWindow(
  id: string,
  preferredSize?: { width?: number; height?: number }
): void {
  if (!canOpenStandaloneApp(id)) return;

  const defaults = getWindowDefaults(id);
  const availableWidth = window.screen?.availWidth || FALLBACK_WINDOW_WIDTH;
  const availableHeight = window.screen?.availHeight || FALLBACK_WINDOW_HEIGHT;
  const width = clampWindowSize(
    preferredSize?.width ?? defaults?.width ?? FALLBACK_WINDOW_WIDTH,
    MIN_STANDALONE_WIDTH,
    availableWidth,
    FALLBACK_WINDOW_WIDTH
  );
  const height = clampWindowSize(
    preferredSize?.height ?? defaults?.height ?? FALLBACK_WINDOW_HEIGHT,
    MIN_STANDALONE_HEIGHT,
    availableHeight,
    FALLBACK_WINDOW_HEIGHT
  );
  const left = Math.max(0, Math.round((availableWidth - width) / 2));
  const top = Math.max(0, Math.round((availableHeight - height) / 2));
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "scrollbars=yes",
    "resizable=yes",
  ].join(",");

  const standaloneUrl = getStandaloneAppUrl(id);
  const opened = window.open(standaloneUrl, `${id}-standalone`, features);

  if (opened) {
    opened.focus();
    return;
  }

  window.location.assign(standaloneUrl);
}
