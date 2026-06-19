import { describe, expect, it, vi } from "vitest";
import {
  FIELD_HEIGHT,
  applyPaperSoccerMove,
  chooseAiMove,
  createInitialPaperSoccerState,
  getLegalMoves,
  getScoringWinner,
  isBoundaryPoint,
  isLegalMove,
  type PaperSoccerState,
} from "./paperSoccer.logic";

describe("paper soccer logic", () => {
  it("starts from the middle of the field", () => {
    const state = createInitialPaperSoccerState();

    expect(state.ball).toEqual({ x: 4, y: 5 });
    expect(state.turn).toBe("home");
    expect(state.visitedPoints).toContain("4:5");
    expect(getLegalMoves(state)).toHaveLength(8);
  });

  it("prevents moving through the same segment twice", () => {
    const firstMove = applyPaperSoccerMove(createInitialPaperSoccerState(), { x: 4, y: 4 });

    expect(firstMove.moved).toBe(true);
    expect(isLegalMove(firstMove.state, { x: 4, y: 5 })).toBe(false);
  });

  it("keeps the turn after bouncing from a visited point", () => {
    const firstMove = applyPaperSoccerMove(createInitialPaperSoccerState(), { x: 4, y: 4 });
    const secondMove = applyPaperSoccerMove(firstMove.state, { x: 5, y: 5 });
    const bounce = applyPaperSoccerMove(secondMove.state, { x: 4, y: 5 });

    expect(bounce.moved).toBe(true);
    expect(bounce.bounce).toBe(true);
    expect(bounce.state.turn).toBe(secondMove.state.turn);
  });

  it("keeps the turn after bouncing from the field boundary", () => {
    const state: PaperSoccerState = {
      ...createInitialPaperSoccerState(),
      ball: { x: 4, y: 1 },
      turn: "away",
      visitedPoints: ["4:1"],
    };

    const result = applyPaperSoccerMove(state, { x: 4, y: 0 });

    expect(isBoundaryPoint(result.state.ball)).toBe(true);
    expect(result.bounce).toBe(true);
    expect(result.state.turn).toBe("away");
  });

  it("scores goals for the correct player", () => {
    expect(getScoringWinner({ x: 4, y: -1 })).toBe("home");
    expect(getScoringWinner({ x: 4, y: FIELD_HEIGHT + 1 })).toBe("away");
  });

  it("ends the match when the ball reaches the opponent goal", () => {
    const state: PaperSoccerState = {
      ...createInitialPaperSoccerState(),
      ball: { x: 4, y: 0 },
      turn: "home",
      visitedPoints: ["4:0"],
    };

    const result = applyPaperSoccerMove(state, { x: 4, y: -1 });

    expect(result.moved).toBe(true);
    expect(result.winner).toBe("home");
    expect(result.state.winner).toBe("home");
  });

  it("declares the blocked player as the loser", () => {
    const state: PaperSoccerState = {
      ball: { x: 1, y: 1 },
      turn: "home",
      visitedPoints: ["1:1"],
      segments: [
        { from: { x: 1, y: 1 }, to: { x: 0, y: 0 }, player: "away" },
        { from: { x: 1, y: 1 }, to: { x: 0, y: 1 }, player: "away" },
        { from: { x: 1, y: 1 }, to: { x: 0, y: 2 }, player: "away" },
        { from: { x: 1, y: 1 }, to: { x: 1, y: 0 }, player: "away" },
        { from: { x: 1, y: 1 }, to: { x: 2, y: 0 }, player: "away" },
        { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, player: "away" },
        { from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, player: "away" },
      ],
      winner: null,
    };

    const result = applyPaperSoccerMove(state, { x: 1, y: 2 });

    expect(result.blockedLoser).toBe("away");
    expect(result.winner).toBe("home");
  });

  it("lets AI choose a legal move", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = createInitialPaperSoccerState();

    const move = chooseAiMove(state, "away");

    expect(move).not.toBeNull();
    expect(move ? isLegalMove(state, move) : false).toBe(true);
  });
});
