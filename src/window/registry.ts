import React from "react";
import youtubeIcon from "@/assets/brand-icons/youtube.svg";
import cardsIcon from "@/assets/game-icons/cards.svg";
import catculatorIcon from "@/assets/game-icons/catculator.svg";
import connect4Icon from "@/assets/game-icons/connect4.svg";
import memoIcon from "@/assets/game-icons/memo.svg";
import minesweeperIcon from "@/assets/game-icons/minesweeper.svg";
import pongIcon from "@/assets/game-icons/pong.svg";
import rpsIcon from "@/assets/game-icons/rps.svg";
import snakeIcon from "@/assets/game-icons/snake.svg";
import tetrisIcon from "@/assets/game-icons/tetris.svg";
import tictactoeIcon from "@/assets/game-icons/tictactoe.svg";
import settingsIcon from "@/assets/system-icons/settings.svg";

export type WindowDefaults = {
  id: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  x?: number;
  y?: number;
  // Lazy loader for content; keeps Desktop lean and enables future code-splitting.
  loader: () => Promise<{ default: React.ComponentType<unknown> }>;
};

export type AppKind = "game" | "system" | "app";

export type AppRegistration = {
  id: string;
  title: string;
  icon: string;
  iconAsset?: string;
  kind: AppKind;
  implemented: boolean;
  showOnDesktop?: boolean;
  window?: Omit<WindowDefaults, "id" | "title">;
};

export type DesktopAppRegistration = AppRegistration & {
  showOnDesktop: true;
};

export const AppRegistry: readonly AppRegistration[] = [
  {
    id: "tictactoe",
    title: "Kółko i Krzyżyk",
    icon: "🔢",
    iconAsset: tictactoeIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 620,
      height: 760,
      minWidth: 420,
      minHeight: 620,
      x: 100,
      y: 70,
      loader: () => import("@/games/tictactoe/TicTacToeGame"),
    },
  },
  {
    id: "memo",
    title: "Memo",
    icon: "🧠",
    iconAsset: memoIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "snake",
    title: "Wąż",
    icon: "🐍",
    iconAsset: snakeIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 820,
      height: 680,
      minWidth: 520,
      minHeight: 640,
      x: 120,
      y: 80,
      loader: () => import("@/games/snake/SnakeGame"),
    },
  },
  {
    id: "youtube",
    title: "YouTube",
    icon: "▶️",
    iconAsset: youtubeIcon,
    kind: "app",
    implemented: true,
    window: {
      width: 920,
      height: 620,
      minWidth: 420,
      minHeight: 360,
      x: 180,
      y: 90,
      loader: () => import("@/apps/youtube/YouTubeApp"),
    },
  },
  {
    id: "rps",
    title: "Kamień Papier Nożyce",
    icon: "✊",
    iconAsset: rpsIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "minesweeper",
    title: "Saper",
    icon: "🚩",
    iconAsset: minesweeperIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 640,
      height: 720,
      minWidth: 520,
      minHeight: 640,
      x: 160,
      y: 100,
      loader: () => import("@/games/minesweeper/MinesweeperGame"),
    },
  },
  {
    id: "tetris",
    title: "Tetris",
    icon: "🧱",
    iconAsset: tetrisIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "connect4",
    title: "Connect 4",
    icon: "🟡",
    iconAsset: connect4Icon,
    kind: "game",
    implemented: false,
  },
  {
    id: "pong",
    title: "Pong",
    icon: "🏓",
    iconAsset: pongIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "cards",
    title: "Ewolucja",
    icon: "🃏",
    iconAsset: cardsIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "calc",
    title: "Catculator",
    icon: "🖩",
    iconAsset: catculatorIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "settings",
    title: "Ustawienia",
    icon: "⚙️",
    iconAsset: settingsIcon,
    kind: "system",
    implemented: true,
  },
] as const;

export const WindowRegistry: Record<string, WindowDefaults> = AppRegistry.reduce<
  Record<string, WindowDefaults>
>((registry, app) => {
  if (!app.window) return registry;

  registry[app.id] = {
    id: app.id,
    title: app.title,
    ...app.window,
  };

  return registry;
}, {});

export function getAppRegistration(id: string): AppRegistration | undefined {
  return AppRegistry.find((app) => app.id === id);
}

export function getDesktopApps(options?: {
  includeUnimplemented?: boolean;
}): DesktopAppRegistration[] {
  const includeUnimplemented = options?.includeUnimplemented ?? false;

  return AppRegistry.filter((app): app is DesktopAppRegistration => {
    const showOnDesktop = app.showOnDesktop ?? true;
    return showOnDesktop && (includeUnimplemented || app.implemented);
  }).map((app) => ({ ...app, showOnDesktop: true }));
}

// Helper to resolve defaults by id (useful for Desktop and other launchers).
export function getWindowDefaults(id: string): WindowDefaults | undefined {
  return WindowRegistry[id];
}
