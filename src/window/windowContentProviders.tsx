import React from "react";
import { PlayerSettingsProvider } from "@/settings/player/PlayerSettingsContext";
import { getAppRegistration } from "./registry";

export function wrapWindowContentWithProviders(id: string, content: React.ReactNode): React.ReactNode {
  const app = getAppRegistration(id);

  if (app?.kind !== "game") {
    return content;
  }

  return <PlayerSettingsProvider>{content}</PlayerSettingsProvider>;
}
