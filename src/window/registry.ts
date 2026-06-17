import React from "react";

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

// Registry maps well-known window ids to their default metadata and content loader.
// Desktop can use this to open windows without hardcoding sizes/positions everywhere.
export const WindowRegistry: Record<string, WindowDefaults> = {
  tictactoe: {
    id: "tictactoe",
    title: "Kółko i Krzyżyk",
    width: 620,
    height: 760,
    minWidth: 420,
    minHeight: 620,
    x: 100,
    y: 70,
    loader: () => import("@/games/tictactoe/TicTacToeGame"),
  },
  snake: {
    id: "snake",
    title: "Wąż",
    width: 820,
    height: 680,
    minWidth: 520,
    minHeight: 640,
    x: 120,
    y: 80,
    loader: () => import("@/games/snake/SnakeGame"),
  },
  minesweeper: {
    id: "minesweeper",
    title: "Saper",
    width: 640,
    height: 720,
    minWidth: 520,
    minHeight: 640,
    x: 160,
    y: 100,
    loader: () => import("@/games/minesweeper/MinesweeperGame"),
  },
};

// Helper to resolve defaults by id (useful for Desktop and other launchers)
export function getWindowDefaults(id: string): WindowDefaults | undefined {
  return WindowRegistry[id];
}
