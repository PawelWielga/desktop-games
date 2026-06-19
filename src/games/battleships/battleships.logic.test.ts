import { describe, expect, it } from "vitest";
import { CELL_COUNT, FLEET, canPlaceShip, createEmptyBoard, createEmptyTargetBoard, createRandomFleetBoard, getCellsForShip, isFleetPlaced, markTargetShot, placeShip, receiveShot, toIndex } from "./battleships.logic";
describe("battleships logic", () => {
  it("creates empty boards", () => { expect(createEmptyBoard()).toHaveLength(CELL_COUNT); expect(createEmptyTargetBoard()).toEqual(Array(CELL_COUNT).fill("unknown")); });
  it("places a ship", () => { const result = placeShip(createEmptyBoard(), FLEET[0], 0, "horizontal"); expect(result.placed).toBe(true); expect(getCellsForShip(result.board, FLEET[0].id)).toEqual([0, 1, 2, 3]); });
  it("rejects ships outside board and touching by corner", () => { const board = placeShip(createEmptyBoard(), FLEET[0], 0, "horizontal").board; expect(canPlaceShip(board, FLEET[1], toIndex({ row: 1, col: 4 }), "vertical")).toBe(false); expect(canPlaceShip(board, FLEET[1], toIndex({ row: 2, col: 0 }), "horizontal")).toBe(true); });
  it("creates random full fleet", () => { expect(isFleetPlaced(createRandomFleetBoard())).toBe(true); });
  it("handles hits and sunk ships", () => { const ship = FLEET.find((item) => item.length === 1); if (!ship) throw new Error("Expected one-cell ship."); const board = placeShip(createEmptyBoard(), ship, 44, "horizontal").board; const shot = receiveShot(board, 44); expect(shot.hit).toBe(true); expect(shot.sunk).toBe(true); expect(shot.allSunk).toBe(true); });
  it("marks target shots", () => { const board = createEmptyTargetBoard(); expect(markTargetShot(board, 1, false, false)[1]).toBe("miss"); expect(markTargetShot(board, 2, true, false)[2]).toBe("hit"); expect(markTargetShot(board, 3, true, true, [3, 4])[4]).toBe("sunk"); });
});
