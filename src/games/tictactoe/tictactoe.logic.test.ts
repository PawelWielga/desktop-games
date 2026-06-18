import { describe, expect, it } from "vitest";
import {
  applyMove,
  chooseAiMove,
  emptyBoard,
  findWinningMove,
  getWinResult,
  isDraw,
  isLegalMove,
  type CellValue,
} from "./tictactoe.logic";

describe("tictactoe logic", () => {
  it("creates an empty starting board", () => {
    expect(emptyBoard()).toEqual(Array<CellValue>(9).fill(null));
  });

  it("applies a legal move and changes the turn", () => {
    const board = emptyBoard();

    const result = applyMove(board, 4, "X");

    expect(result.moved).toBe(true);
    expect(result.board).toEqual([null, null, null, null, "X", null, null, null, null]);
    expect(result.nextTurn).toBe("O");
    expect(board[4]).toBeNull();
  });

  it("rejects a move on an occupied cell", () => {
    const board = applyMove(emptyBoard(), 0, "X").board;

    const result = applyMove(board, 0, "O");

    expect(result.moved).toBe(false);
    expect(result.board).toBe(board);
    expect(result.board[0]).toBe("X");
  });

  it("rejects a move outside the board", () => {
    const board = emptyBoard();

    expect(isLegalMove(board, -1)).toBe(false);
    expect(isLegalMove(board, 9)).toBe(false);
    expect(applyMove(board, 9, "X").moved).toBe(false);
  });

  it.each([
    [["X", "X", "X", null, null, null, null, null, null], [0, 1, 2]],
    [[null, null, null, "X", "X", "X", null, null, null], [3, 4, 5]],
    [[null, null, null, null, null, null, "X", "X", "X"], [6, 7, 8]],
    [["X", null, null, "X", null, null, "X", null, null], [0, 3, 6]],
    [[null, "X", null, null, "X", null, null, "X", null], [1, 4, 7]],
    [[null, null, "X", null, null, "X", null, null, "X"], [2, 5, 8]],
    [["X", null, null, null, "X", null, null, null, "X"], [0, 4, 8]],
    [[null, null, "X", null, "X", null, "X", null, null], [2, 4, 6]],
  ] as const)("detects winning line %j", (board, line) => {
    expect(getWinResult([...board])?.line).toEqual(line);
  });

  it("detects a draw", () => {
    const board: CellValue[] = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];

    expect(getWinResult(board)).toBeNull();
    expect(isDraw(board)).toBe(true);
  });

  it("chooses a winning AI move first", () => {
    const board: CellValue[] = ["O", "O", null, "X", null, null, "X", null, null];

    expect(findWinningMove(board, "O")).toBe(2);
    expect(chooseAiMove(board, "O", "X")).toBe(2);
  });

  it("blocks the human winning move when AI cannot win immediately", () => {
    const board: CellValue[] = ["X", "X", null, null, "O", null, null, null, null];

    expect(chooseAiMove(board, "O", "X")).toBe(2);
  });

  it("chooses the first empty cell as a fallback AI move", () => {
    const board: CellValue[] = ["X", "O", "X", "O", null, null, null, null, null];

    expect(chooseAiMove(board, "O", "X")).toBe(4);
  });
});
