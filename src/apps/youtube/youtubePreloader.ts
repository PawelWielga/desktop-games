const DEFAULT_YOUTUBE_VIDEO_ID = "dQw4w9WgXcQ";
const PRELOADED_PLAYER_ID = "youtube-default-preloaded-player";

let preloadedIframe: HTMLIFrameElement | null = null;
let hiddenHost: HTMLDivElement | null = null;
let deferredPreloadStarted = false;

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

  return `https://www.youtube.com/embed/${DEFAULT_YOUTUBE_VIDEO_ID}?${params.toString()}`;
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
  host.style.width = "1px";
  host.style.height = "1px";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  host.style.opacity = "0";

  document.body.appendChild(host);
  return host;
};

const prepareIframeForHiddenPreload = (iframe: HTMLIFrameElement): void => {
  iframe.width = "1";
  iframe.height = "1";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
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
    JSON.stringify({
      event: "command",
      func,
      args,
    }),
    "https://www.youtube.com"
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

  ensurePreconnect("https://www.youtube.com");
  ensurePreconnect("https://i.ytimg.com");
  ensurePreconnect("https://www.google.com");
  ensurePreconnect("https://googleads.g.doubleclick.net");

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
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.setAttribute("allowfullscreen", "true");

  prepareIframeForHiddenPreload(iframe);
  hiddenHost.appendChild(iframe);
  preloadedIframe = iframe;
};

export const attachDefaultYouTubePlayer = (
  target: HTMLElement | null
): boolean => {
  if (!isBrowser() || !target) return false;

  startDefaultYouTubePreload();
  if (!preloadedIframe) return false;

  prepareIframeForPlayer(preloadedIframe);
  target.textContent = "";
  target.appendChild(preloadedIframe);

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

  return true;
};

export const detachDefaultYouTubePlayer = (): void => {
  if (!isBrowser() || !preloadedIframe) return;

  hiddenHost = hiddenHost ?? createHiddenHost();
  if (!hiddenHost) return;

  postPlayerCommand(preloadedIframe, "mute");
  postPlayerCommand(preloadedIframe, "pauseVideo");
  prepareIframeForHiddenPreload(preloadedIframe);
  hiddenHost.appendChild(preloadedIframe);
};

export const canUsePreloadedYouTubePlayer = (): boolean => isBrowser();
