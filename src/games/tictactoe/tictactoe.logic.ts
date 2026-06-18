export type CellValue = "X" | "O" | null;
export type PlayerSymbol = Exclude<CellValue, null>;

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export type WinningLine = (typeof WIN_LINES)[number];
export type WinResult = { symbol: PlayerSymbol; line: WinningLine };
export type MoveResult = {
  board: CellValue[];
  nextTurn: PlayerSymbol;
  moved: boolean;
};

const BOARD_SIZE = 9;

export function emptyBoard(): CellValue[] {
  return Array<CellValue>(BOARD_SIZE).fill(null);
}

export function isValidCellIndex(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < BOARD_SIZE;
}

export function isLegalMove(board: CellValue[], cell: number): boolean {
  return isValidCellIndex(cell) && board[cell] === null;
}

export function getNextTurn(symbol: PlayerSymbol): PlayerSymbol {
  return symbol === "X" ? "O" : "X";
}

export function applyMove(board: CellValue[], cell: number, symbol: PlayerSymbol): MoveResult {
  if (!isLegalMove(board, cell)) {
    return { board, nextTurn: symbol, moved: false };
  }

  const nextBoard = board.slice();
  nextBoard[cell] = symbol;

  return { board: nextBoard, nextTurn: getNextTurn(symbol), moved: true };
}

export function getWinResult(board: CellValue[]): WinResult | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a], line };
    }
  }

  return null;
}

export function isDraw(board: CellValue[]): boolean {
  return !getWinResult(board) && board.every(Boolean);
}

export function chooseAiMove(board: CellValue[], ai: PlayerSymbol, human: PlayerSymbol): number | null {
  const firstEmptyCell = board.findIndex((value) => value === null);
  return findWinningMove(board, ai) ?? findWinningMove(board, human) ?? (firstEmptyCell >= 0 ? firstEmptyCell : null);
}

export function findWinningMove(board: CellValue[], symbol: PlayerSymbol): number | null {
  for (const [a, b, c] of WIN_LINES) {
    const line = [a, b, c];
    const values = line.map((index) => board[index]);
    if (values.filter((value) => value === symbol).length === 2 && values.includes(null)) {
      return line[values.findIndex((value) => value === null)];
    }
  }

  return null;
}
