import {
  getYouTubeIframeAllow,
  YOUTUBE_IFRAME_REFERRER_POLICY,
  YOUTUBE_IFRAME_SANDBOX,
} from "./youtubeIframePolicy";

const DEFAULT_YOUTUBE_VIDEO_ID = "dQw4w9WgXcQ";
const PRELOADED_PLAYER_ID = "youtube-default-preloaded-player";
const PRELOADED_PLAYER_WIDTH = 320;
const PRELOADED_PLAYER_HEIGHT = 180;
const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

export type YouTubePlayerLoadState = "idle" | "loading" | "ready" | "failed";

let preloadedIframe: HTMLIFrameElement | null = null;
let hiddenHost: HTMLDivElement | null = null;
let deferredPreloadStarted = false;
let preloadedIframeLoadState: YouTubePlayerLoadState = "idle";

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

const getOrigin = (): string =>
  isBrowser() ? window.location.origin : "http://localhost";

const ensurePreconnect = (href: string): void => {
  if (!isBrowser() || document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  document.head.appendChild(link);
};

export const buildDefaultYouTubeSrc = (muted: boolean): string => {
  const params = new URLSearchParams({
    autoplay: "1",
    enablejsapi: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    origin: getOrigin(),
  });

  if (muted) {
    params.set("mute", "1");
  }

  return `${YOUTUBE_EMBED_ORIGIN}/embed/${DEFAULT_YOUTUBE_VIDEO_ID}?${params.toString()}`;
};

const createHiddenHost = (): HTMLDivElement | null => {
  if (!isBrowser() || !document.body) return null;

  const existingHost = document.getElementById(
    `${PRELOADED_PLAYER_ID}-host`
  ) as HTMLDivElement | null;

  if (existingHost) return existingHost;

  const host = document.createElement("div");
  host.id = `${PRELOADED_PLAYER_ID}-host`;
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.width = `${PRELOADED_PLAYER_WIDTH}px`;
  host.style.height = `${PRELOADED_PLAYER_HEIGHT}px`;
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";

  document.body.appendChild(host);
  return host;
};

const prepareIframeForHiddenPreload = (iframe: HTMLIFrameElement): void => {
  iframe.width = String(PRELOADED_PLAYER_WIDTH);
  iframe.height = String(PRELOADED_PLAYER_HEIGHT);
  iframe.style.width = `${PRELOADED_PLAYER_WIDTH}px`;
  iframe.style.height = `${PRELOADED_PLAYER_HEIGHT}px`;
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.tabIndex = -1;
};

const postPlayerCommand = (
  iframe: HTMLIFrameElement,
  func: "mute" | "pauseVideo"
): void => {
  try {
    iframe.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      YOUTUBE_EMBED_ORIGIN
    );
  } catch {
    // YouTube can briefly replace iframe contents while Firefox partitions storage
    // or while React remounts the player. These commands are best-effort only.
  }
};

export const startDefaultYouTubePreload = (): void => {
  if (!isBrowser() || preloadedIframe) return;

  ensurePreconnect(YOUTUBE_EMBED_ORIGIN);
  ensurePreconnect("https://i.ytimg.com");

  hiddenHost = createHiddenHost();
  if (!hiddenHost) {
    if (!deferredPreloadStarted) {
      deferredPreloadStarted = true;
      window.addEventListener("DOMContentLoaded", startDefaultYouTubePreload, {
        once: true,
      });
    }
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.id = PRELOADED_PLAYER_ID;
  iframe.title = "YouTube";
  iframe.setAttribute("loading", "eager");
  iframe.setAttribute("referrerpolicy", YOUTUBE_IFRAME_REFERRER_POLICY);
  iframe.setAttribute("sandbox", YOUTUBE_IFRAME_SANDBOX);

  const allow = getYouTubeIframeAllow();
  if (allow) {
    iframe.allow = allow;
  }

  iframe.setAttribute("allowfullscreen", "true");
  iframe.addEventListener("load", () => {
    preloadedIframeLoadState = "ready";
  });
  iframe.addEventListener("error", () => {
    preloadedIframeLoadState = "failed";
  });

  prepareIframeForHiddenPreload(iframe);
  iframe.src = buildDefaultYouTubeSrc(true);
  hiddenHost.appendChild(iframe);
  preloadedIframe = iframe;
  preloadedIframeLoadState = "loading";
};

export const detachDefaultYouTubePlayer = (): void => {
  if (!isBrowser() || !preloadedIframe) return;

  hiddenHost = hiddenHost ?? createHiddenHost();
  if (!hiddenHost) return;

  postPlayerCommand(preloadedIframe, "mute");
  postPlayerCommand(preloadedIframe, "pauseVideo");
  prepareIframeForHiddenPreload(preloadedIframe);

  if (preloadedIframe.parentElement !== hiddenHost) {
    hiddenHost.appendChild(preloadedIframe);
  }
};

export const canUsePreloadedYouTubePlayer = (): boolean => false;
