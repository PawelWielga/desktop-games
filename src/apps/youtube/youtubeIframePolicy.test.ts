import { describe, expect, it, vi } from "vitest";
import {
  getYouTubeIframeAllow,
  YOUTUBE_IFRAME_ALLOW,
  YOUTUBE_IFRAME_REFERRER_POLICY,
  YOUTUBE_IFRAME_SANDBOX,
  YOUTUBE_IFRAME_SANDBOX_TOKENS,
} from "./youtubeIframePolicy";

const blockedSandboxTokens = [
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
];

describe("YouTube iframe policy", () => {
  it("blocks popups and top-level navigation by omitting dangerous sandbox tokens", () => {
    const sandboxTokens = YOUTUBE_IFRAME_SANDBOX.split(/\s+/);

    expect(sandboxTokens).toEqual([...YOUTUBE_IFRAME_SANDBOX_TOKENS]);
    expect(sandboxTokens).toEqual(
      expect.arrayContaining([
        "allow-scripts",
        "allow-same-origin",
        "allow-presentation",
      ])
    );

    for (const blockedToken of blockedSandboxTokens) {
      expect(sandboxTokens).not.toContain(blockedToken);
    }
  });

  it("keeps the permissions needed for embedded video playback without share or clipboard features", () => {
    const allowFeatures = YOUTUBE_IFRAME_ALLOW.split(";").map((feature) =>
      feature.trim()
    );

    expect(allowFeatures).toEqual(
      expect.arrayContaining([
        "accelerometer",
        "autoplay",
        "encrypted-media",
        "fullscreen",
        "gyroscope",
        "picture-in-picture",
      ])
    );
    expect(allowFeatures).not.toContain("clipboard-write");
    expect(allowFeatures).not.toContain("web-share");
    expect(YOUTUBE_IFRAME_REFERRER_POLICY).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("omits iframe allow in Firefox to avoid unsupported Feature Policy console noise", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 Firefox/152.0",
    });

    expect(getYouTubeIframeAllow()).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
