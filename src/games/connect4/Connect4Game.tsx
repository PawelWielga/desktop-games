import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { usePlayerSettings } from "@/settings/player/PlayerSettingsContext";
import "./connect4.css";

type Player = "red" | "yellow";
type Cell = Player | null;
type Board = Cell[][];
type Mode = "local" | "ai";
type Result = { type: "playing" } | { type: "draw" } | { type: "win"; winner: Player; cells: string[] };
type PlayerAppearance = { labelKey: string; symbol: string; color: string };

const ROWS = 6;
const COLS = 7;
const CONNECT = 4;
const FALLBACK_PLAYERS: Record<Player, PlayerAppearance> = {
  red: { labelKey: "connect4.player.red", symbol: "🔴", color: "#ef4444" },
  yellow: { labelKey: "connect4.player.yellow", symbol: "🟡", color: "#facc15" },
};
const DIRECTIONS: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function key(row: number, col: number): string {
  return `${row}-${col}`;
}

function rowFor(board: Board, col: number): number | null {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (!board[row][col]) return row;
  }
  return null;
}

function availableColumns(board: Board): number[] {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) => rowFor(board, col) !== null);
}

function cloneWithMove(board: Board, row: number, col: number, player: Player): Board {
  return board.map((cells, rowIndex) =>
    rowIndex === row ? cells.map((cell, colIndex) => (colIndex === col ? player : cell)) : [...cells]
  );
}

function winningCells(board: Board, row: number, col: number, player: Player): string[] {
  for (const [rowStep, colStep] of DIRECTIONS) {
    const cells = [key(row, col)];
    for (const side of [-1, 1]) {
      let nextRow = row + rowStep * side;
      let nextCol = col + colStep * side;
      while (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS && board[nextRow][nextCol] === player) {
        cells.push(key(nextRow, nextCol));
        nextRow += rowStep * side;
        nextCol += colStep * side;
      }
    }
    if (cells.length >= CONNECT) return cells;
  }
  return [];
}

function resultAfter(board: Board, row: number, col: number, player: Player): Result {
  const cells = winningCells(board, row, col, player);
  if (cells.length > 0) return { type: "win", winner: player, cells };
  return availableColumns(board).length === 0 ? { type: "draw" } : { type: "playing" };
}

function other(player: Player): Player {
  return player === "red" ? "yellow" : "red";
}

function scoreWindow(cells: readonly Cell[], player: Player): number {
  const opponent = other(player);
  const own = cells.filter((cell) => cell === player).length;
  const enemy = cells.filter((cell) => cell === opponent).length;
  const empty = cells.filter((cell) => cell === null).length;
  if (own === 4) return 100;
  if (own === 3 && empty === 1) return 8;
  if (own === 2 && empty === 2) return 3;
  if (enemy === 3 && empty === 1) return -10;
  return 0;
}

function score(board: Board, player: Player): number {
  let total = board.filter((row) => row[Math.floor(COLS / 2)] === player).length * 3;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - CONNECT; col += 1) total += scoreWindow(board[row].slice(col, col + CONNECT), player);
  }
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row <= ROWS - CONNECT; row += 1) total += scoreWindow([board[row][col], board[row + 1][col], board[row + 2][col], board[row + 3][col]], player);
  }
  for (let row = 0; row <= ROWS - CONNECT; row += 1) {
    for (let col = 0; col <= COLS - CONNECT; col += 1) total += scoreWindow([board[row][col], board[row + 1][col + 1], board[row + 2][col + 2], board[row + 3][col + 3]], player);
  }
  for (let row = CONNECT - 1; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - CONNECT; col += 1) total += scoreWindow([board[row][col], board[row - 1][col + 1], board[row - 2][col + 2], board[row - 3][col + 3]], player);
  }
  return total;
}

function pickAiColumn(board: Board): number | null {
  const columns = availableColumns(board);
  if (columns.length === 0) return null;

  for (const checkedPlayer of ["yellow", "red"] as const) {
    const found = columns.find((col) => {
      const row = rowFor(board, col);
      return row !== null && winningCells(cloneWithMove(board, row, col, checkedPlayer), row, col, checkedPlayer).length > 0;
    });
    if (found !== undefined) return found;
  }

  return columns
    .map((col) => {
      const row = rowFor(board, col);
      return { col, value: row === null ? -Infinity : score(cloneWithMove(board, row, col, "yellow"), "yellow") };
    })
    .sort((a, b) => b.value - a.value)[0].col;
}

function readableAppearance(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export default function Connect4Game(): React.ReactElement {
  const { t } = useTranslation();
  const { settings: playerSettings } = usePlayerSettings();
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [player, setPlayer] = useState<Player>("red");
  const [mode, setMode] = useState<Mode>("local");
  const [result, setResult] = useState<Result>({ type: "playing" });
  const [lastMove, setLastMove] = useState<string | null>(null);

  const playerAppearance = useMemo<Record<Player, PlayerAppearance>>(
    () => ({
      red: {
        ...FALLBACK_PLAYERS.red,
        symbol: readableAppearance(playerSettings.emoji, FALLBACK_PLAYERS.red.symbol),
        color: readableAppearance(playerSettings.color, FALLBACK_PLAYERS.red.color),
      },
      yellow: {
        ...FALLBACK_PLAYERS.yellow,
        symbol: readableAppearance(playerSettings.aiEmoji, FALLBACK_PLAYERS.yellow.symbol),
        color: readableAppearance(playerSettings.aiColor, FALLBACK_PLAYERS.yellow.color),
      },
    }),
    [playerSettings.aiColor, playerSettings.aiEmoji, playerSettings.color, playerSettings.emoji]
  );

  const columns = useMemo(() => availableColumns(board), [board]);
  const finished = result.type !== "playing";
  const aiTurn = mode === "ai" && player === "yellow" && !finished;

  const reset = useCallback((nextMode = mode) => {
    setBoard(createBoard());
    setPlayer("red");
    setResult({ type: "playing" });
    setLastMove(null);
    setMode(nextMode);
  }, [mode]);

  const move = useCallback((col: number, forcedPlayer = player) => {
    if (finished || (mode === "ai" && player === "yellow" && forcedPlayer !== "yellow")) return;
    const row = rowFor(board, col);
    if (row === null) return;
    const nextBoard = cloneWithMove(board, row, col, forcedPlayer);
    const nextResult = resultAfter(nextBoard, row, col, forcedPlayer);
    setBoard(nextBoard);
    setResult(nextResult);
    setLastMove(key(row, col));
    if (nextResult.type === "playing") setPlayer(other(forcedPlayer));
  }, [board, finished, mode, player]);

  const status = result.type === "win"
    ? t("connect4.status.win", { player: t(playerAppearance[result.winner].labelKey) })
    : result.type === "draw"
      ? t("connect4.status.draw")
      : aiTurn
        ? t("connect4.status.aiReady")
        : t("connect4.status.turn", { player: t(playerAppearance[player].labelKey) });

  useEffect(() => {
    if (!aiTurn) return undefined;

    const timeoutId = window.setTimeout(() => {
      const col = pickAiColumn(board);
      if (col !== null) move(col, "yellow");
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [aiTurn, board, move]);

  return (
    <div className="connect4-root">
      <header className="connect4-header">
        <div>
          <p className="connect4-eyebrow">{t("connect4.eyebrow")}</p>
          <h1>{t("connect4.title")}</h1>
          <p className="connect4-intro">{t("connect4.intro")}</p>
        </div>
        <button className="connect4-reset" type="button" onClick={() => reset()}>{t("connect4.newGame")}</button>
      </header>

      <section className="connect4-toolbar" aria-label={t("connect4.settingsAria")}>
        <label className="connect4-mode">
          <span>{t("connect4.mode.label")}</span>
          <select value={mode} onChange={(event) => reset(event.target.value as Mode)}>
            <option value="local">{t("connect4.mode.local")}</option>
            <option value="ai">{t("connect4.mode.ai")}</option>
          </select>
        </label>
        <div className="connect4-player-list" aria-label={t("connect4.playersAria")}>
          {(["red", "yellow"] as const).map((nextPlayer) => (
            <span key={nextPlayer} data-active={player === nextPlayer && !finished}>
              <strong style={{ color: playerAppearance[nextPlayer].color }}>{playerAppearance[nextPlayer].symbol}</strong>
              {t(playerAppearance[nextPlayer].labelKey)}
            </span>
          ))}
        </div>
      </section>

      <section className="connect4-status-card" role="status" aria-live="polite">
        <span>{t("connect4.status.label")}</span>
        <strong>{status}</strong>
      </section>

      <main className="connect4-board-wrap">
        <div className="connect4-column-buttons" aria-label={t("connect4.columnsAria")}>
          {Array.from({ length: COLS }, (_, col) => (
            <button key={col} className="connect4-column-button" type="button" disabled={finished || aiTurn || !columns.includes(col)} onClick={() => move(col)} aria-label={t("connect4.dropInColumn", { column: col + 1 })}>↓</button>
          ))}
        </div>
        <div className="connect4-board" aria-label={t("connect4.boardAria")}>
          {board.map((row, rowIndex) => row.map((cell, colIndex) => {
            const cellKey = key(rowIndex, colIndex);
            return (
              <button
                key={cellKey}
                className="connect4-cell"
                type="button"
                data-player={cell ?? "empty"}
                data-winning={result.type === "win" && result.cells.includes(cellKey)}
                data-last={lastMove === cellKey}
                disabled={finished || aiTurn || !columns.includes(colIndex)}
                onClick={() => move(colIndex)}
                aria-label={cell ? t("connect4.cellOccupied", { row: rowIndex + 1, column: colIndex + 1, player: t(playerAppearance[cell].labelKey) }) : t("connect4.cellEmpty", { row: rowIndex + 1, column: colIndex + 1 })}
              >
                <span style={cell ? { backgroundColor: playerAppearance[cell].color } : undefined}>{cell ? playerAppearance[cell].symbol : ""}</span>
              </button>
            );
          }))}
        </div>
      </main>
      <p className="connect4-help">{t("connect4.help")}</p>
    </div>
  );
}
