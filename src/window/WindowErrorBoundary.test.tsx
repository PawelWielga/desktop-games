import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  WindowErrorBoundary,
  type WindowErrorBoundaryLabels,
} from "./WindowErrorBoundary";

const labels: WindowErrorBoundaryLabels = {
  title: "Aplikacja napotkała błąd",
  message: "Okno gry zostało zatrzymane, ale pulpit nadal działa.",
  close: "Zamknij okno",
  technicalDetails: "Szczegóły techniczne",
  errorMessage: "Komunikat błędu",
  stackTrace: "Stack trace",
  componentStack: "Stos komponentów",
};

function CrashingWindowContent(): React.ReactElement {
  throw new Error("Connect4 crashed");
}

describe("WindowErrorBoundary", () => {
  it("renders an isolated fallback for crashed window content without rethrowing", () => {
    const onClose = vi.fn();
    const boundary = new WindowErrorBoundary({
      children: <CrashingWindowContent />,
      labels,
      onClose,
      windowTitle: "Connect 4",
    });
    const crash = new Error("Connect4 crashed");

    expect(() => {
      boundary.state = {
        error: crash,
        errorInfo: { componentStack: "\n    at Connect4Game" },
      };
      boundary.render();
    }).not.toThrow();

    const fallback = boundary.render();
    expect(React.isValidElement<{ className?: string; role?: string }>(fallback)).toBe(true);

    if (!React.isValidElement<{ className?: string; role?: string }>(fallback)) {
      throw new Error("Expected error boundary fallback to be a React element");
    }

    expect(fallback.props.className).toBe("window-error-boundary");
    expect(fallback.props.role).toBe("alert");
  });

  it("renders healthy window content unchanged", () => {
    const child = <div>Desktop stays alive</div>;
    const boundary = new WindowErrorBoundary({
      children: child,
      labels,
      onClose: vi.fn(),
      windowTitle: "Snake",
    });

    expect(boundary.render()).toBe(child);
  });
});
