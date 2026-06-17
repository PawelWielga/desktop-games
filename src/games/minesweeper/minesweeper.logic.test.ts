import { describe, expect, it } from "vitest";
import {
  createBoard,
  hasWon,
  neighbors,
  placeMinesDeterministic,
  revealFlood,
} from "./minesweeper.logic";

describe("minesweeper logic", () => {
  it("keeps the first clicked cell and its neighbors safe", () => {
    const cols = 5;
    const rows = 5;
    const safeIndex = 12;
    const board = createBoard(cols, rows);
    let value = 0.99;
    const rng = () => {
      value = value > 0.05 ? value - 0.07 : 0.99;
      return value;
    };

    placeMinesDeterministic(board, cols, rows, 5, safeIndex, rng);

    const forbidden = [safeIndex, ...neighbors(safeIndex, cols, rows)];
    expect(forbidden.every((idx) => !board[idx].mine)).toBe(true);
    expect(board.filter((cell) => cell.mine)).toHaveLength(5);
  });

  it("does not reveal flagged cells during flood reveal", () => {
    const board = createBoard(3, 3);
    board[1].flagged = true;

    revealFlood(board, 0, 3, 3);

    expect(board[0].revealed).toBe(true);
    expect(board[1].revealed).toBe(false);
  });

  it("detects win when all non-mine cells are revealed", () => {
    const board = createBoard(2, 2);
    board[0].mine = true;
    board[1].revealed = true;
    board[2].revealed = true;
    board[3].revealed = true;

    expect(hasWon(board, 2, 2, 1)).toBe(true);
  });

  it("does not report win while at least one safe cell is hidden", () => {
    const board = createBoard(2, 2);
    board[0].mine = true;
    board[1].revealed = true;
    board[2].revealed = true;

    expect(hasWon(board, 2, 2, 1)).toBe(false);
  });
});
