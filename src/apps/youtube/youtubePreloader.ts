const DEFAULT_YOUTUBE_VIDEO_ID = "dQw4w9WgXcQ";
const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

const isBrowser = (): boolean => typeof window !== "undefined";

const getOrigin = (): string =>
  isBrowser() ? window.location.origin : "http://localhost";

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

export const startDefaultYouTubePreload = (): void => {
  // Intentionally disabled. The visible YouTube player is rendered by React,
  // so starting a hidden autoplay iframe would duplicate playback and network work.
};
