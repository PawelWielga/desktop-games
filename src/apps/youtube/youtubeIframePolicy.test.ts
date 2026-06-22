import { describe, expect, it } from "vitest";
import {
  YOUTUBE_EMBED_ORIGIN,
  YOUTUBE_IFRAME_ALLOW,
  YOUTUBE_IFRAME_REFERRER_POLICY,
  YOUTUBE_IFRAME_SANDBOX,
} from "./youtubeIframePolicy";

describe("youtube iframe policy", () => {
  it("uses the privacy-enhanced YouTube embed origin", () => {
    expect(YOUTUBE_EMBED_ORIGIN).toBe("https://www.youtube-nocookie.com");
  });

  it("blocks popups and top-level navigation from the embedded player", () => {
    const sandboxTokens = YOUTUBE_IFRAME_SANDBOX.split(" ");

    expect(sandboxTokens).toEqual(
      expect.arrayContaining([
        "allow-scripts",
        "allow-same-origin",
        "allow-presentation",
      ])
    );
    expect(sandboxTokens).not.toContain("allow-popups");
    expect(sandboxTokens).not.toContain("allow-popups-to-escape-sandbox");
    expect(sandboxTokens).not.toContain("allow-top-navigation");
    expect(sandboxTokens).not.toContain(
      "allow-top-navigation-by-user-activation"
    );
  });

  it("does not grant optional share or clipboard permissions", () => {
    expect(YOUTUBE_IFRAME_ALLOW).toContain("autoplay");
    expect(YOUTUBE_IFRAME_ALLOW).toContain("encrypted-media");
    expect(YOUTUBE_IFRAME_ALLOW).not.toContain("web-share");
    expect(YOUTUBE_IFRAME_ALLOW).not.toContain("clipboard-write");
  });

  it("keeps sandbox policy narrow enough to prevent the previous escape regression", () => {
    const sandboxTokens = YOUTUBE_IFRAME_SANDBOX.split(" ");

    expect(sandboxTokens).toEqual([
      "allow-scripts",
      "allow-same-origin",
      "allow-presentation",
    ]);
  });

  it("limits referrer data for the cross-origin iframe", () => {
    expect(YOUTUBE_IFRAME_REFERRER_POLICY).toBe(
      "strict-origin-when-cross-origin"
    );
  });
});
