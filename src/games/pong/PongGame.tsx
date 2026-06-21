import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import "./pong.css";

type Paddle = {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
};

type Ball = {
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
};

type Score = {
  left: number;
  right: number;
};

type GameStatus = "ready" | "playing" | "paused" | "leftScored" | "rightScored";

type PongState = {
  leftPaddle: Paddle;
  rightPaddle: Paddle;
  ball: Ball;
  score: Score;
  status: GameStatus;
};

const BOARD_WIDTH = 400;
const BOARD_HEIGHT = 300;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 60;
const PADDLE_OFFSET = 12;
const PADDLE_SPEED = 260;
const BALL_RADIUS = 5;
const BALL_SPEED_X = 180;
const BALL_SPEED_Y = 120;
const MAX_BOUNCE_Y = 260;
const SCORE_FLASH_MS = 650;
const DPR_CAP = 2;
const KEY_TO_CONTROL: Record<string, { side: "left" | "right"; direction: -1 | 1 } | undefined> = {
  w: { side: "left", direction: -1 },
  s: { side: "left", direction: 1 },
  arrowup: { side: "right", direction: -1 },
  arrowdown: { side: "right", direction: 1 },
};
const PAUSE_KEYS = new Set([" ", "p"]);
const TEXT_ENTRY_SELECTOR = "input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(TEXT_ENTRY_SELECTOR));
}

function focusCanvas(canvas: HTMLCanvasElement | null): void {
  canvas?.focus({ preventScroll: true });
}

function createPaddle(x: number): Paddle {
  return {
    x,
    y: BOARD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    velocityY: 0,
  };
}

function createBall(direction: -1 | 1 = Math.random() > 0.5 ? 1 : -1): Ball {
  return {
    x: BOARD_WIDTH / 2,
    y: BOARD_HEIGHT / 2,
    radius: BALL_RADIUS,
    velocityX: BALL_SPEED_X * direction,
    velocityY: BALL_SPEED_Y * (Math.random() > 0.5 ? 1 : -1),
  };
}

function createInitialState(): PongState {
  return {
    leftPaddle: createPaddle(PADDLE_OFFSET),
    rightPaddle: createPaddle(BOARD_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH),
    ball: createBall(),
    score: { left: 0, right: 0 },
    status: "ready",
  };
}

function resetRound(state: PongState, direction: -1 | 1, status: GameStatus): PongState {
  return {
    ...state,
    leftPaddle: { ...state.leftPaddle, y: BOARD_HEIGHT / 2 - PADDLE_HEIGHT / 2, velocityY: 0 },
    rightPaddle: { ...state.rightPaddle, y: BOARD_HEIGHT / 2 - PADDLE_HEIGHT / 2, velocityY: 0 },
    ball: createBall(direction),
    status,
  };
}

function intersects(ball: Ball, paddle: Paddle): boolean {
  return (
    ball.x + ball.radius >= paddle.x &&
    ball.x - ball.radius <= paddle.x + paddle.width &&
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height
  );
}

function bounceFromPaddle(ball: Ball, paddle: Paddle, direction: -1 | 1): Ball {
  const paddleCenter = paddle.y + paddle.height / 2;
  const hitOffset = clamp((ball.y - paddleCenter) / (paddle.height / 2), -1, 1);
  return {
    ...ball,
    x: direction > 0 ? paddle.x + paddle.width + ball.radius : paddle.x - ball.radius,
    velocityX: Math.abs(ball.velocityX) * direction,
    velocityY: hitOffset * MAX_BOUNCE_Y,
  };
}

function step(state: PongState, deltaSeconds: number): PongState {
  const leftPaddle = {
    ...state.leftPaddle,
    y: clamp(state.leftPaddle.y + state.leftPaddle.velocityY * deltaSeconds, 0, BOARD_HEIGHT - state.leftPaddle.height),
  };
  const rightPaddle = {
    ...state.rightPaddle,
    y: clamp(state.rightPaddle.y + state.rightPaddle.velocityY * deltaSeconds, 0, BOARD_HEIGHT - state.rightPaddle.height),
  };
  let ball = {
    ...state.ball,
    x: state.ball.x + state.ball.velocityX * deltaSeconds,
    y: state.ball.y + state.ball.velocityY * deltaSeconds,
  };

  if (ball.y - ball.radius <= 0) {
    ball = { ...ball, y: ball.radius, velocityY: Math.abs(ball.velocityY) };
  } else if (ball.y + ball.radius >= BOARD_HEIGHT) {
    ball = { ...ball, y: BOARD_HEIGHT - ball.radius, velocityY: -Math.abs(ball.velocityY) };
  }

  if (ball.velocityX < 0 && intersects(ball, leftPaddle)) {
    ball = bounceFromPaddle(ball, leftPaddle, 1);
  } else if (ball.velocityX > 0 && intersects(ball, rightPaddle)) {
    ball = bounceFromPaddle(ball, rightPaddle, -1);
  }

  if (ball.x + ball.radius < 0) {
    return resetRound(
      { ...state, leftPaddle, rightPaddle, score: { ...state.score, right: state.score.right + 1 } },
      -1,
      "rightScored"
    );
  }

  if (ball.x - ball.radius > BOARD_WIDTH) {
    return resetRound(
      { ...state, leftPaddle, rightPaddle, score: { ...state.score, left: state.score.left + 1 } },
      1,
      "leftScored"
    );
  }

  return { ...state, leftPaddle, rightPaddle, ball };
}

function draw(ctx: CanvasRenderingContext2D, state: PongState): void {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(BOARD_WIDTH / 2, 12);
  ctx.lineTo(BOARD_WIDTH / 2, BOARD_HEIGHT - 12);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillRect(state.leftPaddle.x, state.leftPaddle.y, state.leftPaddle.width, state.leftPaddle.height);
  ctx.fillRect(state.rightPaddle.x, state.rightPaddle.y, state.rightPaddle.width, state.rightPaddle.height);

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

export default function PongGame(): React.ReactElement {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<PongState>(createInitialState());
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const scoreFlashTimeoutRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<PongState>(() => stateRef.current);
  const [canvasSize, setCanvasSize] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT });

  const scoreText = useMemo(() => `${snapshot.score.left} : ${snapshot.score.right}`, [snapshot.score.left, snapshot.score.right]);

  const statusText = useMemo(() => {
    if (snapshot.status === "playing") return t("pong.status.playing");
    if (snapshot.status === "paused") return t("pong.status.paused");
    if (snapshot.status === "leftScored") return t("pong.status.leftScored");
    if (snapshot.status === "rightScored") return t("pong.status.rightScored");
    return t("pong.status.ready");
  }, [snapshot.status, t]);

  const publishState = useCallback(() => {
    setSnapshot({
      ...stateRef.current,
      leftPaddle: { ...stateRef.current.leftPaddle },
      rightPaddle: { ...stateRef.current.rightPaddle },
      ball: { ...stateRef.current.ball },
      score: { ...stateRef.current.score },
    });
  }, []);

  const applyInput = useCallback(() => {
    const keys = pressedKeysRef.current;
    const leftUp = keys.has("w");
    const leftDown = keys.has("s");
    const rightUp = keys.has("arrowup");
    const rightDown = keys.has("arrowdown");
    stateRef.current = {
      ...stateRef.current,
      leftPaddle: {
        ...stateRef.current.leftPaddle,
        velocityY: leftUp === leftDown ? 0 : leftUp ? -PADDLE_SPEED : PADDLE_SPEED,
      },
      rightPaddle: {
        ...stateRef.current.rightPaddle,
        velocityY: rightUp === rightDown ? 0 : rightUp ? -PADDLE_SPEED : PADDLE_SPEED,
      },
    };
  }, []);

  const resizeCanvas = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const maxWidth = Math.max(1, wrap.clientWidth - 4);
    const maxHeight = Math.max(1, wrap.clientHeight - 4);
    const scale = Math.min(maxWidth / BOARD_WIDTH, maxHeight / BOARD_HEIGHT);
    const cssWidth = Math.floor(BOARD_WIDTH * scale);
    const cssHeight = Math.floor(BOARD_HEIGHT * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

    canvas.width = Math.floor(BOARD_WIDTH * dpr);
    canvas.height = Math.floor(BOARD_HEIGHT * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    setCanvasSize({ width: cssWidth, height: cssHeight });

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, stateRef.current);
  }, []);

  const startGame = useCallback(() => {
    if (scoreFlashTimeoutRef.current) {
      window.clearTimeout(scoreFlashTimeoutRef.current);
      scoreFlashTimeoutRef.current = null;
    }
    stateRef.current = { ...createInitialState(), status: "playing" };
    pressedKeysRef.current.clear();
    lastFrameRef.current = null;
    publishState();
    window.requestAnimationFrame(() => focusCanvas(canvasRef.current));
  }, [publishState]);

  const togglePause = useCallback(() => {
    const status = stateRef.current.status;
    if (status !== "playing" && status !== "paused") return;
    stateRef.current = { ...stateRef.current, status: status === "playing" ? "paused" : "playing" };
    pressedKeysRef.current.clear();
    lastFrameRef.current = null;
    publishState();
  }, [publishState]);

  const shouldHandleKeyboardEvent = useCallback((event: KeyboardEvent) => {
    const root = rootRef.current;
    const target = event.target;
    if (!root || !(target instanceof Node) || !root.contains(target)) return false;
    return !isTextEntryTarget(target);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (time: number) => {
      const state = stateRef.current;
      const lastFrame = lastFrameRef.current ?? time;
      const deltaSeconds = Math.min((time - lastFrame) / 1000, 0.05);
      lastFrameRef.current = time;

      if (state.status === "playing") {
        applyInput();
        const next = step(stateRef.current, deltaSeconds);
        const scored = next.status === "leftScored" || next.status === "rightScored";
        stateRef.current = next;
        if (scored) {
          publishState();
          if (scoreFlashTimeoutRef.current) window.clearTimeout(scoreFlashTimeoutRef.current);
          scoreFlashTimeoutRef.current = window.setTimeout(() => {
            stateRef.current = { ...stateRef.current, status: "playing" };
            publishState();
          }, SCORE_FLASH_MS);
        }
      }

      draw(ctx, stateRef.current);
      animationFrameRef.current = window.requestAnimationFrame(render);
    };

    animationFrameRef.current = window.requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [applyInput, publishState]);

  useEffect(() => {
    resizeCanvas();
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!shouldHandleKeyboardEvent(event)) {
        if (PAUSE_KEYS.has(key) || KEY_TO_CONTROL[key]) pressedKeysRef.current.clear();
        return;
      }

      if (PAUSE_KEYS.has(key)) {
        event.preventDefault();
        togglePause();
        return;
      }

      const control = KEY_TO_CONTROL[key];
      if (!control) return;
      event.preventDefault();
      pressedKeysRef.current.add(key);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!KEY_TO_CONTROL[key]) return;
      pressedKeysRef.current.delete(key);
      if (!shouldHandleKeyboardEvent(event)) return;
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [shouldHandleKeyboardEvent, togglePause]);

  useEffect(() => {
    const clearPressedKeys = () => pressedKeysRef.current.clear();
    window.addEventListener("blur", clearPressedKeys);
    return () => window.removeEventListener("blur", clearPressedKeys);
  }, []);

  useEffect(() => {
    return () => {
      if (scoreFlashTimeoutRef.current) window.clearTimeout(scoreFlashTimeoutRef.current);
    };
  }, []);

  return (
    <section className="pong-root" aria-label={t("pong.title")} ref={rootRef}>
      <header className="pong-header">
        <div>
          <p className="pong-eyebrow">{t("pong.eyebrow")}</p>
          <h1>{t("pong.title")}</h1>
          <p className="pong-intro">{t("pong.intro")}</p>
        </div>
        <button className="pong-primary-button" type="button" onClick={startGame}>
          {t(snapshot.status === "ready" ? "pong.start" : "pong.restart")}
        </button>
      </header>

      <div className="pong-scoreboard" aria-label={t("pong.scoreboardAria")}>
        <div>
          <span>{t("pong.player.left")}</span>
          <strong>{snapshot.score.left}</strong>
        </div>
        <p aria-live="polite">{scoreText}</p>
        <div>
          <span>{t("pong.player.right")}</span>
          <strong>{snapshot.score.right}</strong>
        </div>
      </div>

      <div className="pong-status-card">
        <span>{t("pong.status.label")}</span>
        <strong aria-live="polite">{statusText}</strong>
      </div>

      <div className="pong-board-wrap" ref={wrapRef} onPointerDown={() => focusCanvas(canvasRef.current)}>
        <canvas
          ref={canvasRef}
          className="pong-canvas"
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          aria-label={t("pong.boardAria")}
          role="img"
          tabIndex={0}
          style={{ width: canvasSize.width, height: canvasSize.height }}
        />
      </div>

      <footer className="pong-help">
        <span>{t("pong.controls.left")}</span>
        <span>{t("pong.controls.right")}</span>
        <span>{t("pong.controls.pause")}</span>
      </footer>
    </section>
  );
}
