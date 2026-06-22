import React, { useEffect } from "react";
import { SettingsProvider, useSettings } from "@/settings/SettingsContext";
import Desktop from "@/desktop/Desktop";
import DirectGameRoute, { getDirectGameIdFromLocation } from "@/direct/DirectGameRoute";
import { WindowManager } from "@/window/WindowManager";

/**
 * Hook: Updates the #clock element textContent every second.
 * Side-effect is isolated and cleaned up on unmount.
 */
function useClock(locale: string): void {
  useEffect(() => {
    const el = document.getElementById("clock");
    const updateClock = () => {
      const now = new Date();
      const time = now.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      if (el) el.textContent = time;
    };
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, [locale]);
}

function ClockUpdater(): null {
  const { settings } = useSettings();
  useClock(settings.language === "pl" ? "pl-PL" : "en-GB");
  return null;
}

function DesktopShell(): React.ReactElement {
  return (
    <>
      <ClockUpdater />
      <WindowManager>
        <Desktop />
      </WindowManager>
    </>
  );
}

function AppContent(): React.ReactElement {
  const directGameId = getDirectGameIdFromLocation();

  if (directGameId) {
    return <DirectGameRoute appId={directGameId} />;
  }

  return <DesktopShell />;
}

export default function App(): React.ReactElement {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
