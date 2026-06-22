import React from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { PlayerSettingsProvider } from "@/settings/player/PlayerSettingsContext";
import { getAppRegistration } from "./registry";
import { WindowErrorBoundary, type WindowErrorBoundaryLabels } from "./WindowErrorBoundary";

type WindowContentWithProvidersProps = {
  id: string;
  content: React.ReactNode;
};

const labelsByLanguage: Record<string, WindowErrorBoundaryLabels> = {
  pl: {
    title: "Aplikacja napotkała błąd",
    message:
      "To okno zostało zatrzymane po błędzie, ale pulpit i pozostałe aplikacje nadal działają. Zamknij okno z paska tytułu i uruchom aplikację ponownie.",
    close: "Zamknij okno",
    technicalDetails: "Szczegóły techniczne",
    errorMessage: "Komunikat błędu",
    stackTrace: "Stack trace",
    componentStack: "Stos komponentów",
  },
  en: {
    title: "Application encountered an error",
    message:
      "This window stopped after an error, but the desktop and other apps are still running. Close it from the title bar and start the app again.",
    close: "Close window",
    technicalDetails: "Technical details",
    errorMessage: "Error message",
    stackTrace: "Stack trace",
    componentStack: "Component stack",
  },
};

function WindowContentWithProviders({ id, content }: WindowContentWithProvidersProps): React.ReactElement {
  const app = getAppRegistration(id);
  const { language, t } = useTranslation();
  const labels = labelsByLanguage[language] ?? labelsByLanguage.pl;
  const contentWithProviders =
    app?.kind === "game" ? <PlayerSettingsProvider>{content}</PlayerSettingsProvider> : content;

  return (
    <WindowErrorBoundary
      labels={{
        ...labels,
        close: t("window.close"),
      }}
      windowTitle={app?.title ?? id}
    >
      {contentWithProviders}
    </WindowErrorBoundary>
  );
}

export function wrapWindowContentWithProviders(id: string, content: React.ReactNode): React.ReactNode {
  return <WindowContentWithProviders id={id} content={content} />;
}
