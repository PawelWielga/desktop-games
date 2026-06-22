import React, { Suspense, useEffect, useMemo } from "react";
import {
  getAppRegistration,
  getWindowDefaults,
  type AppRegistration,
  type WindowDefaults,
} from "@/window/registry";
import { useTranslation } from "@/i18n/useTranslation";
import "./direct-game-route.css";

type DirectGameRouteProps = {
  appId: string;
};

type DirectGameComponent = React.ComponentType<Record<string, never>>;

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function toPathSegments(value: string): string[] {
  const normalized = trimSlashes(value.trim());
  if (!normalized || normalized === ".") return [];
  return normalized.split("/").filter(Boolean);
}

function safelyDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isDirectGameRegistration(app: AppRegistration | undefined): app is AppRegistration & {
  window: NonNullable<AppRegistration["window"]>;
} {
  return Boolean(app?.implemented && app.kind === "game" && app.window);
}

export function getDirectGameIdFromPathname(
  pathname: string,
  basePath: string = import.meta.env.BASE_URL
): string | undefined {
  const pathSegments = toPathSegments(pathname);
  const baseSegments = toPathSegments(basePath);
  const routeSegments =
    baseSegments.length > 0 && baseSegments.every((segment, index) => pathSegments[index] === segment)
      ? pathSegments.slice(baseSegments.length)
      : pathSegments;

  if (routeSegments.length !== 1) return undefined;

  const appId = safelyDecodePathSegment(routeSegments[0] ?? "");
  const app = getAppRegistration(appId);
  return isDirectGameRegistration(app) ? app.id : undefined;
}

export function getDirectGameIdFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return getDirectGameIdFromPathname(window.location.pathname);
}

function DirectGameContent({
  registration,
  defaults,
}: {
  registration: AppRegistration;
  defaults: WindowDefaults;
}): React.ReactElement {
  const { t } = useTranslation();
  const title = registration.titleKey ? t(registration.titleKey) : registration.title;
  const GameComponent = useMemo(
    () => React.lazy(defaults.loader as () => Promise<{ default: DirectGameComponent }>),
    [defaults.loader]
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.documentElement.dataset.directGame = "1";
    document.title = title;

    return () => {
      delete document.documentElement.dataset.directGame;
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <main className="direct-game-route" aria-label={title}>
      <div className="direct-game-route__content">
        <Suspense fallback={<div className="direct-game-loading">Ładowanie gry…</div>}>
          <GameComponent />
        </Suspense>
      </div>
    </main>
  );
}

export default function DirectGameRoute({ appId }: DirectGameRouteProps): React.ReactElement {
  const registration = getAppRegistration(appId);
  const defaults = getWindowDefaults(appId);

  if (!isDirectGameRegistration(registration) || !defaults) {
    return <main className="direct-game-route direct-game-route--empty">Nie znaleziono gry.</main>;
  }

  return <DirectGameContent registration={registration} defaults={defaults} />;
}
