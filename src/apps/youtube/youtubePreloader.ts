import {
  YOUTUBE_EMBED_ORIGIN,
  YOUTUBE_IFRAME_ALLOW,
  YOUTUBE_IFRAME_REFERRER_POLICY,
  YOUTUBE_IFRAME_SANDBOX,
} from "./youtubeIframePolicy";

const DEFAULT_YOUTUBE_VIDEO_ID = "dQw4w9WgXcQ";
const PRELOADED_PLAYER_ID = "youtube-default-preloaded-player";
const PRELOADED_PLAYER_WIDTH = 320;
const PRELOADED_PLAYER_HEIGHT = 180;

export type YouTubePlayerLoadState = "idle" | "loading" | "ready" | "failed";

type AttachDefaultYouTubePlayerCallbacks = {
  onLoad?: () => void;
  onError?: () => void;
};

type AttachedDefaultYouTubePlayer = {
  attached: boolean;
  dispose: () => void;
};

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

const prepareIframeForPlayer = (iframe: HTMLIFrameElement): void => {
  iframe.removeAttribute("width");
  iframe.removeAttribute("height");
  iframe.style.width = "";
  iframe.style.height = "";
  iframe.style.border = "";
  iframe.style.opacity = "";
  iframe.style.pointerEvents = "";
  iframe.removeAttribute("tabindex");
};

const postPlayerCommand = (
  iframe: HTMLIFrameElement,
  func: "mute" | "unMute" | "playVideo" | "pauseVideo" | "seekTo" | "setVolume",
  args: Array<number | boolean> = []
): void => {
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    YOUTUBE_EMBED_ORIGIN
  );
};

const wakeDefaultPlayer = (iframe: HTMLIFrameElement): void => {
  postPlayerCommand(iframe, "seekTo", [0, true]);
  postPlayerCommand(iframe, "setVolume", [100]);
  postPlayerCommand(iframe, "unMute");
  postPlayerCommand(iframe, "playVideo");
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
  iframe.src = buildDefaultYouTubeSrc(true);
  iframe.setAttribute("loading", "eager");
  iframe.setAttribute("referrerpolicy", YOUTUBE_IFRAME_REFERRER_POLICY);
  iframe.setAttribute("sandbox", YOUTUBE_IFRAME_SANDBOX);
  iframe.allow = YOUTUBE_IFRAME_ALLOW;
  iframe.setAttribute("allowfullscreen", "true");
  iframe.addEventListener("load", () => {
    preloadedIframeLoadState = "ready";
  });
  iframe.addEventListener("error", () => {
    preloadedIframeLoadState = "failed";
  });

  prepareIframeForHiddenPreload(iframe);
  hiddenHost.appendChild(iframe);
  preloadedIframe = iframe;
  preloadedIframeLoadState = "loading";
};

export const attachDefaultYouTubePlayer = (
  target: HTMLElement | null,
  callbacks: AttachDefaultYouTubePlayerCallbacks = {}
): AttachedDefaultYouTubePlayer => {
  if (!isBrowser() || !target) {
    return { attached: false, dispose: () => undefined };
  }

  startDefaultYouTubePreload();
  if (!preloadedIframe) {
    return { attached: false, dispose: () => undefined };
  }

  let disposed = false;
  const handleLoad = (): void => {
    if (!disposed) callbacks.onLoad?.();
  };
  const handleError = (): void => {
    if (!disposed) callbacks.onError?.();
  };

  if (preloadedIframeLoadState === "ready") {
    callbacks.onLoad?.();
  } else if (preloadedIframeLoadState === "failed") {
    callbacks.onError?.();
  } else {
    preloadedIframe.addEventListener("load", handleLoad, { once: true });
    preloadedIframe.addEventListener("error", handleError, { once: true });
  }

  prepareIframeForPlayer(preloadedIframe);
  if (preloadedIframe.parentElement !== target) {
    target.appendChild(preloadedIframe);
  }

  wakeDefaultPlayer(preloadedIframe);
  window.setTimeout(() => {
    if (preloadedIframe?.parentElement === target) {
      wakeDefaultPlayer(preloadedIframe);
    }
  }, 250);
  window.setTimeout(() => {
    if (preloadedIframe?.parentElement === target) {
      wakeDefaultPlayer(preloadedIframe);
    }
  }, 750);

  return {
    attached: true,
    dispose: () => {
      disposed = true;
      preloadedIframe?.removeEventListener("load", handleLoad);
      preloadedIframe?.removeEventListener("error", handleError);
    },
  };
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

export const canUsePreloadedYouTubePlayer = (): boolean => isBrowser();
