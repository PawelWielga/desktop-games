export const YOUTUBE_IFRAME_ALLOW_TOKENS = [
  "accelerometer",
  "autoplay",
  "encrypted-media",
  "fullscreen",
  "gyroscope",
  "picture-in-picture",
] as const;

export const YOUTUBE_IFRAME_ALLOW = YOUTUBE_IFRAME_ALLOW_TOKENS.join("; ");

export const YOUTUBE_IFRAME_SANDBOX_TOKENS = [
  "allow-scripts",
  "allow-same-origin",
  "allow-presentation",
] as const;

export const YOUTUBE_IFRAME_SANDBOX = YOUTUBE_IFRAME_SANDBOX_TOKENS.join(" ");

export const YOUTUBE_IFRAME_REFERRER_POLICY = "strict-origin-when-cross-origin";

const isFirefox = (): boolean =>
  typeof navigator !== "undefined" && /\bFirefox\//.test(navigator.userAgent);

export const getYouTubeIframeAllow = (): string | undefined => {
  if (isFirefox()) {
    return undefined;
  }

  return YOUTUBE_IFRAME_ALLOW;
};
