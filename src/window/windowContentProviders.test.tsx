import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Connect4Game from "@/games/connect4/Connect4Game";
import { SettingsProvider } from "@/settings/SettingsContext";
import { wrapWindowContentWithProviders } from "./windowContentProviders";

describe("window content providers", () => {
  it("documents that Connect4 requires player settings context", () => {
    expect(() => {
      renderToString(
        <SettingsProvider>
          <Connect4Game />
        </SettingsProvider>
      );
    }).toThrow("usePlayerSettings must be used within PlayerSettingsProvider");
  });

  it("wraps Connect4 window content with PlayerSettingsProvider", () => {
    expect(() => {
      renderToString(
        <SettingsProvider>
          {wrapWindowContentWithProviders("connect4", <Connect4Game />)}
        </SettingsProvider>
      );
    }).not.toThrow();
  });
});
