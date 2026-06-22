import { describe, expect, it } from "vitest";

import { resolveDirectGameRouteAppId } from "./directGameRouteAliases";

describe("resolveDirectGameRouteAppId", () => {
  it("keeps regular app ids unchanged", () => {
    expect(resolveDirectGameRouteAppId("countries-cities")).toBe("countries-cities");
  });

  it("maps cc to countries-cities", () => {
    expect(resolveDirectGameRouteAppId("cc")).toBe("countries-cities");
  });

  it("matches shortcut case-insensitively and ignores extra whitespace", () => {
    expect(resolveDirectGameRouteAppId(" CC ")).toBe("countries-cities");
  });
});
