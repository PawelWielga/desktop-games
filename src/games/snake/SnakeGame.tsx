import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/settings/SettingsContext";
import "./snake.css";
import {
  DIR_VECTORS,
  type Dir,
  type Point,
  type SnakeState,
  placeFood,
  step,
} from "./snake.logic";

/** Constants */
const DEFAULT_GRID_SIZE = 24;
const DEFAULT_COLS = 32;
const DEFAULT_ROWS = 24;
const MIN_CELL_PX = 8;
const BG_COLOR = "#101418";
const GRID_STROKE = "rgba(255,255,255,0.05)";
const HEAD_COLOR = "#4caf50";
const BODY_COLOR = "#81c784";
const FOOD_COLOR = "#d9534f";
// Loop and input constants
const TICK_BASE_MS = 1000;
const GRID_LINE_WIDTH = 1;
const QUEUE_DRAIN_PER_TICK = 1 as const;
const START_DIR: Dir = "right";
const INITIAL_SNAKE: Point[] = [{ x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }];
const INITIAL_FOOD: Point = { x: 10, y: 10 };
const PAUSE_KEYS = new Set([" ", "p"]);
const DIR_KEYS: Record<string, Dir | undefined> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

/** Component */
export default function SnakeGame(): React.ReactElement {
  const { settings } = useSettings();
  const speed = useMemo(() => {
    switch (settings.difficulty) {
      case "easy":
        return 8;
      case "hard":
        return 14;
      default:
        return 10;
    }
  }, [settings.difficulty]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const grid = { size: DEFAULT_GRID_SIZE, cols: DEFAULT_COLS, rows: DEFAULT_ROWS };
  const [dir, setDir] = useState<Dir>(START_DIR);
  const dirQueue = useRef<Dir[]>([]);
  const [alive, setAlive] = useState(true);
  const [paused, setPaused] = useState(false);

  // Deterministic-friendly RNG infra (seeded xorshift32; defaults to Math.random until rebuildRng is called)
  const seedRef = useRef<number>(Date.now() >>> 0);
  const rngRef = useRef<() => number>(Math.random);
  const rebuildRng = useCallback((seed?: number) => {
    let s = (seed ?? seedRef.current) || 1;
    // xorshift32
    rngRef.current = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      const u = (s >>> 0) / 0xffffffff;
      return u;
    };
    seedRef.current = s >>> 0;
  }, []);

  // Engine state
  const [engine, setEngine] = useState<SnakeState>(() => ({
    snake: INITIAL_SNAKE,
    dir: DIR_VECTORS[START_DIR],
    food: INITIAL_FOOD,
    score: 0,
    alive: true,
  }));

  // Ensure initial food is not inside the snake
  useEffect(() => {
    setEngine((s) => ({ ...s, food: placeFood(grid.cols, grid.rows, s.snake, rngRef.current) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (PAUSE_KEYS.has(key)) {
        setPaused((p) => !p);
        return;
      }
      const next = DIR_KEYS[key];
      if (!next) return;

      const curr = dirQueue.current.length ? dirQueue.current[dirQueue.current.length - 1] : dir;
      const opposite =
        (curr === "up" && next === "down") ||
        (curr === "down" && next === "up") ||
        (curr === "left" && next === "right") ||
        (curr === "right" && next === "left");
      if (opposite) return;

      dirQueue.current.push(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dir]);

  // Render helpers: isolate drawing
  function draw(ctx: CanvasRenderingContext2D, eng: SnakeState, cols: number, rows: number, cell: number): void {
    const w = cols * cell;
    const h = rows * cell;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = GRID_STROKE;
    ctx.lineWidth = GRID_LINE_WIDTH;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(w, y * cell + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = FOOD_COLOR;
    ctx.fillRect(eng.food.x * cell, eng.food.y * cell, cell, cell);

    for (let i = 0; i < eng.snake.length; i++) {
      const p = eng.snake[i];
      ctx.fillStyle = i === 0 ? HEAD_COLOR : BODY_COLOR;
      ctx.fillRect(p.x * cell, p.y * cell, cell, cell);
    }
  }

  // Refs for loop to avoid effect deps churn
  const engineRef = useRef(engine);
  const dirRef = useRef(dir);
  const aliveRef = useRef(alive);
  const scoreRef = useRef(score);
  const cellSizeRef = useRef<number>(grid.size);

  useEffect(() => { engineRef.current = engine; }, [engine]);
  useEffect(() => { dirRef.current = dir; }, [dir]);
  useEffect(() => { aliveRef.current = alive; }, [alive]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // Render and update loop
  const rafRef = useRef<number | null>(null);
  const lastStep = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const stepMs = TICK_BASE_MS / speed;

    const updateCanvasSize = () => {
      const wrap = canvas.parentElement as HTMLElement | null;
      if (!wrap) return;
      const availW = wrap.clientWidth;
      const availH = wrap.clientHeight;
      const cellSizeW = Math.floor(availW / grid.cols);
      const cellSizeH = Math.floor(availH / grid.rows);
      const cell = Math.max(MIN_CELL_PX, Math.min(cellSizeW, cellSizeH));
      const w = grid.cols * cell;
      const h = grid.rows * cell;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      cellSizeRef.current = cell;
    };

    const ro = new ResizeObserver(updateCanvasSize);
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    updateCanvasSize();

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!aliveRef.current || paused) {
        // Still draw current frame to keep visuals up to date
        draw(ctx, engineRef.current, grid.cols, grid.rows, cellSizeRef.current);
        return;
      }

      if (t - lastStep.current >= stepMs) {
        lastStep.current = t;
        // drain limited queued dirs per tick
        for (let i = 0; i < QUEUE_DRAIN_PER_TICK && dirQueue.current.length; i++) {
          setDir(dirQueue.current.shift()!);
        }
        setEngine((s) => {
          const next = step(s, dirRef.current, { cols: grid.cols, rows: grid.rows, rng: rngRef.current });
          return next;
        });
      }

      draw(ctx, engineRef.current, grid.cols, grid.rows, cellSizeRef.current);

      // HUD sync without extra rerenders
      if (engineRef.current.score !== scoreRef.current) setScore(engineRef.current.score);
      if (!engineRef.current.alive && aliveRef.current) setAlive(false);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [speed, paused, grid.cols, grid.rows]);

  const reset = useCallback(() => {
    dirQueue.current = [];
    setDir(START_DIR);
    setAlive(true);
    setPaused(false);
    setScore(0);
    // Optional: reseed for a fresh deterministic run; keep default to Date.now()
    rebuildRng();
    const startSnake = INITIAL_SNAKE;
    const startFood = placeFood(grid.cols, grid.rows, startSnake, rngRef.current);
    setEngine({
      snake: startSnake,
      dir: DIR_VECTORS[START_DIR],
      food: startFood,
      score: 0,
      alive: true,
    });
  }, [grid.cols, grid.rows, rebuildRng]);

  return (
    <div className="snake-root" role="group" aria-label="Snake">
      <div className="snake-hud">
        <span>Score: {score}</span>
        <span>Speed: {speed}</span>
        <button onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</button>
        <button onClick={reset}>Restart</button>
        {!alive && <span className="dead">Game Over</span>}
      </div>
      <div className="snake-canvas-wrap">
        <canvas ref={canvasRef} aria-label="Snake canvas" />
      </div>
      <div className="snake-help">Arrows / WASD to steer. Space to pause.</div>
    </div>
  );
}