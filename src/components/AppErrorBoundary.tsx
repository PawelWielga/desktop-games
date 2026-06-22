import React from "react";

export type AppLaunchMode = "desktop-window" | "direct-route" | "unknown";
export type AppErrorSource = "AppErrorBoundary" | "AppLoader";
export type AppErrorKind = "game" | "system" | "app" | "unknown";

export type AppErrorContext = {
  appId: string;
  appTitle: string;
  appTitleKey?: string;
  appKind: AppErrorKind;
  launchMode: AppLaunchMode;
};

type SafeErrorDetails = {
  name: string;
  message: string;
  stack?: string;
};

export type SafeAppErrorLogPayload = {
  source: AppErrorSource;
  app: {
    id: string;
    title: string;
    titleKey?: string;
    kind: AppErrorKind;
    launchMode: AppLaunchMode;
  };
  build: {
    mode: string;
    production: boolean;
  };
  location: {
    path: string;
    basePath: string;
  };
  error: SafeErrorDetails;
  react?: {
    componentStack?: string;
  };
};

type AppErrorBoundaryProps = {
  context: AppErrorContext;
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

const MAX_LOG_FIELD_LENGTH = 4_000;
const NON_ERROR_MESSAGE = "Non-Error value thrown";

function truncateLogField(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.length > MAX_LOG_FIELD_LENGTH
    ? `${trimmed.slice(0, MAX_LOG_FIELD_LENGTH)}…[truncated]`
    : trimmed;
}

function getSafeRoutePath(): string {
  if (typeof window === "undefined") return "server";

  return window.location.pathname || "/";
}

function toSafeErrorDetails(error: unknown): SafeErrorDetails {
  if (error instanceof Error) {
    return {
      name: truncateLogField(error.name) ?? "Error",
      message: truncateLogField(error.message) ?? "(empty error message)",
      stack: truncateLogField(error.stack),
    };
  }

  if (typeof error === "string") {
    return {
      name: "NonError",
      message: truncateLogField(error) ?? NON_ERROR_MESSAGE,
    };
  }

  return {
    name: "NonError",
    message: NON_ERROR_MESSAGE,
  };
}

export function createSafeAppErrorLogPayload(
  error: unknown,
  errorInfo: React.ErrorInfo | undefined,
  context: AppErrorContext,
  source: AppErrorSource = "AppErrorBoundary"
): SafeAppErrorLogPayload {
  const componentStack = truncateLogField(errorInfo?.componentStack);

  return {
    source,
    app: {
      id: context.appId,
      title: context.appTitle,
      titleKey: context.appTitleKey,
      kind: context.appKind,
      launchMode: context.launchMode,
    },
    build: {
      mode: import.meta.env.MODE ?? "unknown",
      production: import.meta.env.PROD,
    },
    location: {
      path: getSafeRoutePath(),
      basePath: import.meta.env.BASE_URL ?? "/",
    },
    error: toSafeErrorDetails(error),
    react: componentStack ? { componentStack } : undefined,
  };
}

export function logAppError(
  error: unknown,
  errorInfo: React.ErrorInfo | undefined,
  context: AppErrorContext,
  source: AppErrorSource = "AppErrorBoundary"
): void {
  const payload = createSafeAppErrorLogPayload(error, errorInfo, context, source);
  console.error("[desktop-games] Application error", payload);
}

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logAppError(error, errorInfo, this.props.context);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const showDeveloperDetails = import.meta.env.DEV && this.state.error;

    return (
      <div
        role="alert"
        style={{
          boxSizing: "border-box",
          minHeight: "220px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.25rem",
          color: "#f5f7fb",
          background: "rgba(10, 15, 25, 0.94)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Aplikacja napotkała błąd</h2>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Możesz zamknąć to okno i uruchomić aplikację ponownie. Szczegóły diagnostyczne
          zapisano w konsoli przeglądarki.
        </p>
        {showDeveloperDetails && (
          <details>
            <summary>Szczegóły developerskie</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "14rem" }}>
              {this.state.error?.stack ?? this.state.error?.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
