export type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number;
};

export type Difficulty = { cols: number; rows: number; mines: number };

export const DEFAULT_DIFFICULTY: Difficulty = { cols: 9, rows: 9, mines: 10 };

export function inBounds(c: number, r: number, cols: number, rows: number): boolean {
  return c >= 0 && c < cols && r >= 0 && r < rows;
}

export function neighbors(index: number, cols: number, rows: number): number[] {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const result: number[] = [];

  for (let rr = r - 1; rr <= r + 1; rr++) {
    for (let cc = c - 1; cc <= c + 1; cc++) {
      if (rr === r && cc === c) continue;
      if (inBounds(cc, rr, cols, rows)) result.push(rr * cols + cc);
    }
  }

  return result;
}

export function createBoard(cols: number, rows: number): Cell[] {
  return Array.from({ length: cols * rows }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adj: 0,
  }));
}

export function placeMinesDeterministic(
  board: Cell[],
  cols: number,
  rows: number,
  mines: number,
  safeIndex: number,
  rng: () => number
): void {
  const forbidden = new Set([safeIndex, ...neighbors(safeIndex, cols, rows)]);
  let placed = 0;

  while (placed < mines) {
    const pos = Math.floor(rng() * board.length);
    if (forbidden.has(pos)) continue;
    if (!board[pos].mine) {
      board[pos].mine = true;
      placed++;
    }
  }

  for (let i = 0; i < board.length; i++) {
    if (board[i].mine) continue;
    const adj = neighbors(i, cols, rows).reduce((acc, n) => acc + (board[n].mine ? 1 : 0), 0);
    board[i].adj = adj;
  }
}

export function revealFlood(board: Cell[], start: number, cols: number, rows: number): void {
  const stack = [start];

  while (stack.length) {
    const idx = stack.pop()!;
    const cell = board[idx];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    if (!cell.mine && cell.adj === 0) {
      for (const n of neighbors(idx, cols, rows)) {
        if (!board[n].revealed && !board[n].flagged) stack.push(n);
      }
    }
  }
}

export function computeWaveDistances(
  revealedNow: Set<number>,
  startIdx: number,
  cols: number,
  rows: number
): Map<number, number> {
  const dist = new Map<number, number>();
  if (!revealedNow.size) return dist;

  const seed = revealedNow.has(startIdx) ? startIdx : [...revealedNow][0];
  dist.set(seed, 0);

  const q: number[] = [seed];
  while (q.length) {
    const u = q.shift()!;
    const du = dist.get(u)!;
    for (const v of neighbors(u, cols, rows)) {
      if (!revealedNow.has(v)) continue;
      if (dist.has(v)) continue;
      dist.set(v, du + 1);
      q.push(v);
    }
  }

  return dist;
}

export function hasWon(board: Cell[], cols: number, rows: number, mines: number): boolean {
  const total = cols * rows;
  let revealedSafe = 0;
  let minesCount = 0;

  for (let i = 0; i < total; i++) {
    const c = board[i];
    if (c.mine) minesCount++;
    else if (c.revealed) revealedSafe++;
  }

  return minesCount === mines && revealedSafe === total - mines;
}
