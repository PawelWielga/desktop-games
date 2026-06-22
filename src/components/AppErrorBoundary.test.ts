import { describe, expect, it } from "vitest";
import { createSafeAppErrorLogPayload, type AppErrorContext } from "./AppErrorBoundary";

const context: AppErrorContext = {
  appId: "connect4",
  appTitle: "Connect 4",
  appTitleKey: "apps.connect4",
  appKind: "game",
  launchMode: "desktop-window",
};

describe("AppErrorBoundary logging", () => {
  it("keeps app context but does not serialize arbitrary thrown object fields", () => {
    const payload = createSafeAppErrorLogPayload(
      { message: "boom", password: "secret-token" },
      { componentStack: "\n    at Connect4Game" },
      context
    );

    expect(payload.app).toMatchObject({
      id: "connect4",
      title: "Connect 4",
      titleKey: "apps.connect4",
      kind: "game",
      launchMode: "desktop-window",
    });
    expect(payload.error).toEqual({
      name: "NonError",
      message: "Non-Error value thrown",
    });
    expect(payload.react?.componentStack).toContain("Connect4Game");
    expect(JSON.stringify(payload)).not.toContain("secret-token");
  });

  it("truncates very long stack traces before logging", () => {
    const error = new Error("boom");
    error.stack = "x".repeat(5_000);

    const payload = createSafeAppErrorLogPayload(error, undefined, context);

    expect(payload.error.stack).toContain("[truncated]");
    expect(payload.error.stack?.length).toBeLessThanOrEqual(4_012);
  });
});
