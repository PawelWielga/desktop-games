export const BOARD_SIZE = 10;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export type Orientation = "horizontal" | "vertical";
export type ShotMark = "miss" | "hit" | "sunk";
export type Coordinate = { row: number; col: number };
export type ShipDefinition = { id: string; length: number; labelKey: string };
export type BoardCell = { shipId: string | null; shot: boolean };
export type TargetCell = ShotMark | "unknown" | "pending";
export type ShotResult = {
  board: BoardCell[];
  valid: boolean;
  hit: boolean;
  sunk: boolean;
  allSunk: boolean;
  shipId: string | null;
  shipCells: number[];
};
export type PlacementResult = { board: BoardCell[]; placed: boolean };

export const FLEET: readonly ShipDefinition[] = [
  { id: "ship-4-1", length: 4, labelKey: "battleships.ship.four" },
  { id: "ship-3-1", length: 3, labelKey: "battleships.ship.threeA" },
  { id: "ship-3-2", length: 3, labelKey: "battleships.ship.threeB" },
  { id: "ship-2-1", length: 2, labelKey: "battleships.ship.twoA" },
  { id: "ship-2-2", length: 2, labelKey: "battleships.ship.twoB" },
  { id: "ship-2-3", length: 2, labelKey: "battleships.ship.twoC" },
  { id: "ship-1-1", length: 1, labelKey: "battleships.ship.oneA" },
  { id: "ship-1-2", length: 1, labelKey: "battleships.ship.oneB" },
  { id: "ship-1-3", length: 1, labelKey: "battleships.ship.oneC" },
  { id: "ship-1-4", length: 1, labelKey: "battleships.ship.oneD" },
] as const;

export function createEmptyBoard(): BoardCell[] {
  return Array.from({ length: CELL_COUNT }, () => ({ shipId: null, shot: false }));
}

export function createEmptyTargetBoard(): TargetCell[] {
  return Array<TargetCell>(CELL_COUNT).fill("unknown");
}

export function toIndex({ row, col }: Coordinate): number {
  return row * BOARD_SIZE + col;
}

export function toCoordinate(index: number): Coordinate {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

export function isValidIndex(index: unknown): index is number {
  return Number.isInteger(index) && Number(index) >= 0 && Number(index) < CELL_COUNT;
}

export function getShipCells(startIndex: number, length: number, orientation: Orientation): number[] {
  const cells = getProjectedShipCells(startIndex, length, orientation);
  return cells.length === length ? cells : [];
}

export function getProjectedShipCells(startIndex: number, length: number, orientation: Orientation): number[] {
  if (!isValidIndex(startIndex)) return [];

  const start = toCoordinate(startIndex);
  const cells: number[] = [];

  for (let offset = 0; offset < length; offset += 1) {
    const row = orientation === "vertical" ? start.row + offset : start.row;
    const col = orientation === "horizontal" ? start.col + offset : start.col;

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) break;
    cells.push(toIndex({ row, col }));
  }

  return cells;
}

export function getAdjacentIndexes(index: number): number[] {
  if (!isValidIndex(index)) return [];

  const { row, col } = toCoordinate(index);
  const indexes: number[] = [];

  for (let r = -1; r <= 1; r += 1) {
    for (let c = -1; c <= 1; c += 1) {
      if (r === 0 && c === 0) continue;

      const nextRow = row + r;
      const nextCol = col + c;

      if (nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE) {
        indexes.push(toIndex({ row: nextRow, col: nextCol }));
      }
    }
  }

  return indexes;
}

export function getSurroundingIndexes(indexes: number[]): number[] {
  const source = new Set(indexes.filter(isValidIndex));
  const surrounding = new Set<number>();

  for (const index of source) {
    for (const adjacentIndex of getAdjacentIndexes(index)) {
      if (!source.has(adjacentIndex)) surrounding.add(adjacentIndex);
    }
  }

  return [...surrounding];
}

export function canPlaceShip(board: BoardCell[], ship: ShipDefinition, startIndex: number, orientation: Orientation): boolean {
  const cells = getShipCells(startIndex, ship.length, orientation);
  if (cells.length !== ship.length) return false;

  return cells.every(
    (index) => !board[index]?.shipId && getAdjacentIndexes(index).every((adjacentIndex) => !board[adjacentIndex]?.shipId)
  );
}

export function placeShip(board: BoardCell[], ship: ShipDefinition, startIndex: number, orientation: Orientation): PlacementResult {
  if (!canPlaceShip(board, ship, startIndex, orientation)) return { board, placed: false };

  const nextBoard = board.map((cell) => ({ ...cell }));
  for (const index of getShipCells(startIndex, ship.length, orientation)) {
    nextBoard[index].shipId = ship.id;
  }

  return { board: nextBoard, placed: true };
}

export function removeShip(board: BoardCell[], shipId: string): BoardCell[] {
  return board.map((cell) => (cell.shipId === shipId ? { ...cell, shipId: null } : { ...cell }));
}

export function getPlacedShipIds(board: BoardCell[]): string[] {
  return [...new Set(board.map((cell) => cell.shipId).filter((shipId): shipId is string => Boolean(shipId)))];
}

export function isFleetPlaced(board: BoardCell[]): boolean {
  const placed = new Set(getPlacedShipIds(board));
  return FLEET.every((ship) => placed.has(ship.id));
}

export function getCellsForShip(board: BoardCell[], shipId: string): number[] {
  return board.reduce<number[]>((cells, cell, index) => {
    if (cell.shipId === shipId) cells.push(index);
    return cells;
  }, []);
}

export function areAllShipsSunk(board: BoardCell[]): boolean {
  const shipCells = board.filter((cell) => cell.shipId);
  return shipCells.length > 0 && shipCells.every((cell) => cell.shot);
}

export function receiveShot(board: BoardCell[], index: number): ShotResult {
  if (!isValidIndex(index) || board[index].shot) {
    return { board, valid: false, hit: false, sunk: false, allSunk: areAllShipsSunk(board), shipId: null, shipCells: [] };
  }

  const nextBoard = board.map((cell) => ({ ...cell }));
  nextBoard[index].shot = true;

  const shipId = nextBoard[index].shipId;
  const shipCells = shipId ? getCellsForShip(nextBoard, shipId) : [];
  const sunk = shipId ? shipCells.every((cellIndex) => nextBoard[cellIndex].shot) : false;

  if (sunk) {
    for (const surroundingIndex of getSurroundingIndexes(shipCells)) {
      if (!nextBoard[surroundingIndex].shipId) {
        nextBoard[surroundingIndex].shot = true;
      }
    }
  }

  return {
    board: nextBoard,
    valid: true,
    hit: Boolean(shipId),
    sunk,
    allSunk: areAllShipsSunk(nextBoard),
    shipId,
    shipCells: sunk ? shipCells : [],
  };
}

export function markTargetShot(
  targetBoard: TargetCell[],
  index: number,
  hit: boolean,
  sunk: boolean,
  shipCells: number[] = []
): TargetCell[] {
  if (!isValidIndex(index)) return targetBoard;

  const sunkCells = sunk ? (shipCells.length ? shipCells.filter(isValidIndex) : [index]) : [];
  const nextBoard = targetBoard.slice();
  nextBoard[index] = hit ? "hit" : "miss";

  if (sunk) {
    for (const cell of sunkCells) {
      nextBoard[cell] = "sunk";
    }

    for (const surroundingIndex of getSurroundingIndexes(sunkCells)) {
      if (nextBoard[surroundingIndex] === "unknown" || nextBoard[surroundingIndex] === "pending") {
        nextBoard[surroundingIndex] = "miss";
      }
    }
  }

  return nextBoard;
}

export function chooseAiShot(board: BoardCell[]): number | null {
  const wounded = getWoundedShipTargets(board);
  if (wounded.length > 0) return wounded[0];

  const candidates = board
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => !cell.shot)
    .map(({ index }) => index);

  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

export function createRandomFleetBoard(maxAttempts = 2000): BoardCell[] {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let board = createEmptyBoard();
    let failed = false;

    for (const ship of FLEET) {
      const placement = placeRandomShip(board, ship);
      if (!placement.placed) {
        failed = true;
        break;
      }
      board = placement.board;
    }

    if (!failed && isFleetPlaced(board)) return board;
  }

  throw new Error("Nie udało się losowo ustawić floty.");
}

function placeRandomShip(board: BoardCell[], ship: ShipDefinition): PlacementResult {
  for (let attempt = 0; attempt < CELL_COUNT * 3; attempt += 1) {
    const index = Math.floor(Math.random() * CELL_COUNT);
    const orientation: Orientation = Math.random() > 0.5 ? "horizontal" : "vertical";
    const placement = placeShip(board, ship, index, orientation);
    if (placement.placed) return placement;
  }

  return { board, placed: false };
}

function getWoundedShipTargets(board: BoardCell[]): number[] {
  const targets = new Set<number>();

  for (const shipId of getPlacedShipIds(board)) {
    const shipCells = getCellsForShip(board, shipId);
    const hitCells = shipCells.filter((index) => board[index].shot);
    const isSunk = shipCells.length > 0 && shipCells.every((index) => board[index].shot);

    if (hitCells.length === 0 || isSunk) continue;

    for (const hitCell of hitCells) {
      for (const adjacentIndex of getOrthogonalIndexes(hitCell)) {
        if (!board[adjacentIndex].shot) targets.add(adjacentIndex);
      }
    }
  }

  return [...targets];
}

function getOrthogonalIndexes(index: number): number[] {
  if (!isValidIndex(index)) return [];

  const { row, col } = toCoordinate(index);
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ]
    .filter(({ row: nextRow, col: nextCol }) => nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE)
    .map(toIndex);
}
