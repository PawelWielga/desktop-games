export type Point = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";
export type Vec = { x: number; y: number };
export type SnakeState = {
  snake: Point[];
  dir: Vec;
  food: Point;
  score: number;
  alive: boolean;
};

const FOOD_PLACE_ATTEMPTS = 100;
const SCORE_PER_FOOD = 10;

export const DIR_VECTORS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function wrap(v: number, max: number): number {
  return (v + max) % max;
}

function randInt(max: number, rng: () => number): number {
  return Math.floor(rng() * max);
}

export function placeFood(cols: number, rows: number, taken: Point[], rng: () => number): Point {
  const takenKey = new Set(taken.map((p) => `${p.x},${p.y}`));
  for (let attempt = 0; attempt < FOOD_PLACE_ATTEMPTS; attempt++) {
    const p = { x: randInt(cols, rng), y: randInt(rows, rng) };
    if (!takenKey.has(`${p.x},${p.y}`)) return p;
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!takenKey.has(`${x},${y}`)) return { x, y };
    }
  }

  return { x: 0, y: 0 };
}

export function step(
  state: SnakeState,
  input: Dir,
  cfg: { cols: number; rows: number; rng: () => number }
): SnakeState {
  if (!state.alive) return state;

  const d = DIR_VECTORS[input];
  const head = {
    x: wrap(state.snake[0].x + d.x, cfg.cols),
    y: wrap(state.snake[0].y + d.y, cfg.rows),
  };
  const body = [head, ...state.snake];
  const ate = head.x === state.food.x && head.y === state.food.y;

  let food = state.food;
  let score = state.score;
  if (ate) {
    score += SCORE_PER_FOOD;
    food = placeFood(cfg.cols, cfg.rows, body, cfg.rng);
  } else {
    body.pop();
  }

  const collided = body.slice(1).some((p) => p.x === head.x && p.y === head.y);
  return { snake: body, dir: d, food, score, alive: !collided };
}
