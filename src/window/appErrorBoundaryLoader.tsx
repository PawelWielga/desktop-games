import React from "react";
import AppErrorBoundary, {
  logAppError,
  type AppErrorContext,
  type AppLaunchMode,
} from "@/components/AppErrorBoundary";
import type { AppRegistration, WindowDefaults } from "./registry";

function isDirectRouteForApp(appId: string): boolean {
  if (typeof window === "undefined") return false;

  const normalizedPath = window.location.pathname.replace(/\/+$/g, "");
  const encodedAppId = encodeURIComponent(appId);

  return normalizedPath.endsWith(`/${appId}`) || normalizedPath.endsWith(`/${encodedAppId}`);
}

function getLaunchModeForApp(appId: string): AppLaunchMode {
  if (typeof document !== "undefined" && document.documentElement.dataset.directGame === "1") {
    return "direct-route";
  }

  return isDirectRouteForApp(appId) ? "direct-route" : "desktop-window";
}

function createAppErrorContext(app: AppRegistration): AppErrorContext {
  return {
    appId: app.id,
    appTitle: app.title,
    appTitleKey: app.titleKey,
    appKind: app.kind,
    launchMode: getLaunchModeForApp(app.id),
  };
}

export function createErrorBoundaryLoader(
  app: AppRegistration,
  loader: WindowDefaults["loader"]
): WindowDefaults["loader"] {
  return async () => {
    try {
      const mod = await loader();
      const Component = mod.default;

      const WrappedApp: React.ComponentType<unknown> = (props) => (
        <AppErrorBoundary context={createAppErrorContext(app)}>
          {React.createElement(
            Component as React.ComponentType<Record<string, unknown>>,
            (props ?? {}) as Record<string, unknown>
          )}
        </AppErrorBoundary>
      );

      WrappedApp.displayName = `${app.id}-error-boundary`;

      return { default: WrappedApp };
    } catch (error) {
      logAppError(error, undefined, createAppErrorContext(app), "AppLoader");
      throw error;
    }
  };
}
