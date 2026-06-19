import { useCallback } from "react";
import { useSettings } from "@/settings/SettingsContext";
import { translate, type TranslationVariables } from "./translations";

export type TranslationFunction = (key: string, variables?: TranslationVariables) => string;

export function useTranslation(): { language: string; t: TranslationFunction } {
  const { settings } = useSettings();
  const { language } = settings;

  const t = useCallback<TranslationFunction>(
    (key, variables) => translate(language, key, variables),
    [language]
  );

  return { language, t };
}
