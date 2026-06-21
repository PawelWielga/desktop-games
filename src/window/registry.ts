import React from "react";
import youtubeIcon from "@/assets/brand-icons/youtube.svg";
import battleshipsIcon from "@/assets/game-icons/battleships.svg";
import cardsIcon from "@/assets/game-icons/cards.svg";
import cellEvolutionIcon from "@/assets/game-icons/cell-evolution.svg";
import catculatorIcon from "@/assets/game-icons/catculator.svg";
import connect4Icon from "@/assets/game-icons/connect4.svg";
import memoIcon from "@/assets/game-icons/memo.svg";
import foldedMonsterIcon from "@/assets/game-icons/folded-monster.svg";
import generallyIcon from "@/assets/game-icons/generally.svg";
import countriesCitiesIcon from "@/assets/game-icons/countries-cities.svg";
import minesweeperIcon from "@/assets/game-icons/minesweeper.svg";
import paperSoccerIcon from "@/assets/game-icons/paper-soccer.svg";
import pongIcon from "@/assets/game-icons/pong.svg";
import rpsIcon from "@/assets/game-icons/rps.svg";
import snakeIcon from "@/assets/game-icons/snake.svg";
import tetrisIcon from "@/assets/game-icons/tetris.svg";
import tictactoeIcon from "@/assets/game-icons/tictactoe.svg";
import settingsIcon from "@/assets/system-icons/settings.svg";
import { startDefaultYouTubePreload } from "../apps/youtube/youtubePreloader";

startDefaultYouTubePreload();

export type WindowDefaults = {
  id: string;
  title: string;
  titleKey?: string;
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
  titleKey: string;
  icon: string;
  iconAsset?: string;
  kind: AppKind;
  implemented: boolean;
  showOnDesktop?: boolean;
  window?: Omit<WindowDefaults, "id" | "title" | "titleKey">;
};

export type DesktopAppRegistration = AppRegistration & {
  showOnDesktop: true;
};

export const AppRegistry: readonly AppRegistration[] = [
  {
    id: "tictactoe",
    title: "Kółko i Krzyżyk",
    titleKey: "apps.tictactoe",
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
    id: "battleships",
    title: "Okręty",
    titleKey: "apps.battleships",
    icon: "⚓",
    iconAsset: battleshipsIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 1040,
      height: 760,
      minWidth: 720,
      minHeight: 620,
      x: 130,
      y: 80,
      loader: () => import("@/games/battleships/BattleshipsGame"),
    },
  },
  {
    id: "paper-soccer",
    title: "Piłkarzyki na kartce",
    titleKey: "apps.paperSoccer",
    icon: "⚽",
    iconAsset: paperSoccerIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 760,
      height: 820,
      minWidth: 520,
      minHeight: 620,
      x: 150,
      y: 90,
      loader: () => import("@/games/paper-soccer/PaperSoccerGame"),
    },
  },
  {
    id: "folded-monster",
    title: "Składany Rysunek",
    titleKey: "apps.foldedMonster",
    icon: "👹",
    iconAsset: foldedMonsterIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 860,
      height: 760,
      minWidth: 520,
      minHeight: 620,
      x: 170,
      y: 100,
      loader: () => import("@/games/folded-monster/FoldedMonsterGame"),
    },
  },
  {
    id: "countries-cities",
    title: "Państwa Miasta",
    titleKey: "apps.countriesCities",
    icon: "🌍",
    iconAsset: countriesCitiesIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 940,
      height: 760,
      minWidth: 640,
      minHeight: 620,
      x: 190,
      y: 110,
      loader: () => import("@/games/countries-cities/CountriesCitiesGame"),
    },
  },

  {
    id: "cell-evolution",
    title: "Ewolucja komórki",
    titleKey: "apps.cellEvolution",
    icon: "🦠",
    iconAsset: cellEvolutionIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 980,
      height: 720,
      minWidth: 620,
      minHeight: 520,
      x: 150,
      y: 80,
      loader: () => import("@/games/cell-evolution/CellEvolutionGame"),
    },
  },

  {
    id: "generally",
    title: "Wyścigi 3D",
    titleKey: "apps.racing3d",
    icon: "🏁",
    iconAsset: generallyIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 1120,
      height: 760,
      minWidth: 760,
      minHeight: 560,
      x: 110,
      y: 60,
      loader: () => import("@/games/generally/GenerallyGame"),
    },
  },
  {
    id: "memo",
    title: "Memo",
    titleKey: "apps.memo",
    icon: "🧠",
    iconAsset: memoIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 720,
      height: 760,
      minWidth: 460,
      minHeight: 560,
      x: 140,
      y: 90,
      loader: () => import("@/games/memo/MemoGame"),
    },
  },
  {
    id: "snake",
    title: "Wąż",
    titleKey: "apps.snake",
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
    titleKey: "apps.youtube",
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
    titleKey: "apps.rps",
    icon: "✊",
    iconAsset: rpsIcon,
    kind: "game",
    implemented: true,
    window: {
      width: 720,
      height: 620,
      minWidth: 460,
      minHeight: 480,
      x: 180,
      y: 110,
      loader: () => import("@/games/rps/RpsGame"),
    },
  },
  {
    id: "minesweeper",
    title: "Saper",
    titleKey: "apps.minesweeper",
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
    titleKey: "apps.tetris",
    icon: "🧱",
    iconAsset: tetrisIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "connect4",
    title: "Connect 4",
    titleKey: "apps.connect4",
    icon: "🟡",
    iconAsset: connect4Icon,
    kind: "game",
    implemented: true,
    window: {
      width: 760,
      height: 720,
      minWidth: 480,
      minHeight: 520,
      x: 170,
      y: 90,
      loader: () => import("@/games/connect4/Connect4Game"),
    },
  },
  {
    id: "pong",
    title: "Pong",
    titleKey: "apps.pong",
    icon: "🏓",
    iconAsset: pongIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "cards",
    title: "Ewolucja",
    titleKey: "apps.cards",
    icon: "🃏",
    iconAsset: cardsIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "calc",
    title: "Catculator",
    titleKey: "apps.calc",
    icon: "🖩",
    iconAsset: catculatorIcon,
    kind: "game",
    implemented: false,
  },
  {
    id: "settings",
    title: "Ustawienia",
    titleKey: "apps.settings",
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
    titleKey: app.titleKey,
    ...app.window,
  };

  return registry;
}, {});

export function getAppRegistration(id: string): AppRegistration | undefined {
  return AppRegistry.find((app) => app.id === id);
}

export function getAppTitleKey(id: string): string | undefined {
  return getAppRegistration(id)?.titleKey;
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
