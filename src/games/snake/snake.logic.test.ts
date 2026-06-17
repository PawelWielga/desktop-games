import { describe, expect, it } from "vitest";
import { DIR_VECTORS, placeFood, step, type SnakeState } from "./snake.logic";

describe("snake logic", () => {
  it("moves the snake without growing when food is not eaten", () => {
    const state: SnakeState = {
      snake: [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }],
      dir: DIR_VECTORS.right,
      food: { x: 10, y: 10 },
      score: 0,
      alive: true,
    };

    const next = step(state, "right", { cols: 12, rows: 12, rng: () => 0 });

    expect(next.snake).toEqual([{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }]);
    expect(next.score).toBe(0);
    expect(next.alive).toBe(true);
  });

  it("grows and scores after eating food", () => {
    const state: SnakeState = {
      snake: [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }],
      dir: DIR_VECTORS.right,
      food: { x: 4, y: 5 },
      score: 0,
      alive: true,
    };

    const next = step(state, "right", { cols: 12, rows: 12, rng: () => 0.9 });

    expect(next.snake).toHaveLength(4);
    expect(next.score).toBe(10);
    expect(next.food).not.toEqual({ x: 4, y: 5 });
  });

  it("detects collision with its own body", () => {
    const state: SnakeState = {
      snake: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }],
      dir: DIR_VECTORS.down,
      food: { x: 9, y: 9 },
      score: 0,
      alive: true,
    };

    const next = step(state, "down", { cols: 12, rows: 12, rng: () => 0 });

    expect(next.alive).toBe(false);
  });

  it("places food on the first free cell when random attempts are blocked", () => {
    const food = placeFood(3, 3, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ], () => 0);

    expect(food).toEqual({ x: 0, y: 1 });
  });
});
