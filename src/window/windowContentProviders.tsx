import React from "react";
import { PlayerSettingsProvider } from "@/settings/player/PlayerSettingsContext";
import { getAppRegistration } from "./registry";
import { WindowErrorBoundary, type WindowErrorBoundaryLabels } from "./WindowErrorBoundary";

const windowErrorBoundaryLabels: WindowErrorBoundaryLabels = {
  title: "Aplikacja napotkała błąd",
  message:
    "To okno zostało zatrzymane po błędzie, ale pulpit i pozostałe aplikacje nadal działają. Zamknij okno z paska tytułu i uruchom aplikację ponownie.",
  close: "Zamknij okno",
  technicalDetails: "Szczegóły techniczne",
  errorMessage: "Komunikat błędu",
  stackTrace: "Stack trace",
  componentStack: "Stos komponentów",
};

export function wrapWindowContentWithProviders(id: string, content: React.ReactNode): React.ReactNode {
  const app = getAppRegistration(id);
  const contentWithProviders =
    app?.kind === "game" ? <PlayerSettingsProvider>{content}</PlayerSettingsProvider> : content;

  return (
    <WindowErrorBoundary labels={windowErrorBoundaryLabels} windowTitle={app?.title ?? id}>
      {contentWithProviders}
    </WindowErrorBoundary>
  );
}
