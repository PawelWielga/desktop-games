import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import {
  applyLevelUpUpgrade,
  canEat,
  circlesOverlap,
  clamp,
  getDamageFromEnemy,
  getEnemyXp,
  getLevelProgress,
  moveTowards,
  normalize,
  type PlayerStats,
  type UpgradeId,
  type Vector2,
} from './cellEvolution.logic';
import './cell-evolution.css';

type Food = {
  id: number;
  position: Vector2;
  size: number;
};

type Enemy = {
  id: number;
  position: Vector2;
  target: Vector2;
  size: number;
  speed: number;
};

type GamePhase = 'running' | 'level-up' | 'game-over';

type World = {
  width: number;
  height: number;
};

type GameState = {
  phase: GamePhase;
  player: PlayerStats & { position: Vector2 };
  foods: Food[];
  enemies: Enemy[];
  world: World;
  nextEntityId: number;
  lastDamageAt: number;
};

type HudSnapshot = {
  phase: GamePhase;
  player: GameState['player'];
  foodCount: number;
  enemyCount: number;
};

type Viewport = {
  scale: number;
  left: number;
  top: number;
  offsetX: number;
  offsetY: number;
};

type UpgradeOption = {
  id: UpgradeId;
  titleKey: string;
  descriptionKey: string;
};

const WORLD: World = { width: 1280, height: 860 };
const INITIAL_PLAYER = {
  speed: 180,
  size: 18,
  eatRange: 2,
  xp: 0,
  xpToNext: 12,
  hp: 100,
  maxHp: 100,
  level: 1,
  position: { x: WORLD.width / 2, y: WORLD.height / 2 },
};
const FOOD_TARGET = 72;
const ENEMY_TARGET = 13;
const FOOD_XP = 1;
const DAMAGE_COOLDOWN_MS = 650;
const KEYBOARD_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
]);

const UPGRADES: readonly UpgradeOption[] = [
  {
    id: 'speed',
    titleKey: 'cellEvolution.upgrade.speed.title',
    descriptionKey: 'cellEvolution.upgrade.speed.description',
  },
  {
    id: 'hp',
    titleKey: 'cellEvolution.upgrade.hp.title',
    descriptionKey: 'cellEvolution.upgrade.hp.description',
  },
  {
    id: 'reach',
    titleKey: 'cellEvolution.upgrade.reach.title',
    descriptionKey: 'cellEvolution.upgrade.reach.description',
  },
] as const;

function createInitialState(): GameState {
  return {
    phase: 'running',
    player: { ...INITIAL_PLAYER, position: { ...INITIAL_PLAYER.position } },
    foods: [],
    enemies: [],
    world: WORLD,
    nextEntityId: 1,
    lastDamageAt: 0,
  };
}

function createSnapshot(state: GameState): HudSnapshot {
  return {
    phase: state.phase,
    player: { ...state.player, position: { ...state.player.position } },
    foodCount: state.foods.length,
    enemyCount: state.enemies.length,
  };
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPoint(world: World, margin = 28): Vector2 {
  return {
    x: randomBetween(margin, world.width - margin),
    y: randomBetween(margin, world.height - margin),
  };
}

function createFood(id: number, world: World): Food {
  return {
    id,
    position: randomPoint(world, 18),
    size: randomBetween(4, 7),
  };
}

function createEnemy(id: number, world: World): Enemy {
  const size = randomBetween(12, 36);

  return {
    id,
    position: randomPoint(world, 48),
    target: randomPoint(world, 48),
    size,
    speed: randomBetween(45, 92) * (size > 26 ? 0.78 : 1),
  };
}

function ensureSpawns(state: GameState): void {
  while (state.foods.length < FOOD_TARGET) {
    state.foods.push(createFood(state.nextEntityId, state.world));
    state.nextEntityId += 1;
  }

  while (state.enemies.length < ENEMY_TARGET) {
    state.enemies.push(createEnemy(state.nextEntityId, state.world));
    state.nextEntityId += 1;
  }
}

function calculateViewport(
  canvas: HTMLCanvasElement,
  state: GameState,
): Viewport {
  const width = canvas.width;
  const height = canvas.height;
  const zoom = Math.max(0.58, 1 - (state.player.level - 1) * 0.06);
  const baseScale = Math.min(width / 680, height / 460);
  const scale = Math.max(0.28, baseScale * zoom);
  const visibleWidth = width / scale;
  const visibleHeight = height / scale;

  const left = clamp(
    state.player.position.x - visibleWidth / 2,
    0,
    Math.max(0, state.world.width - visibleWidth),
  );
  const top = clamp(
    state.player.position.y - visibleHeight / 2,
    0,
    Math.max(0, state.world.height - visibleHeight),
  );

  return {
    scale,
    left,
    top,
    offsetX: Math.max(0, (width - state.world.width * scale) / 2),
    offsetY: Math.max(0, (height - state.world.height * scale) / 2),
  };
}

function screenToWorld(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  clientX: number,
  clientY: number,
): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x:
      viewport.left +
      ((clientX - rect.left) * scaleX) / viewport.scale -
      viewport.offsetX / viewport.scale,
    y:
      viewport.top +
      ((clientY - rect.top) * scaleY) / viewport.scale -
      viewport.offsetY / viewport.scale,
  };
}

function updateKeyboardMovement(
  state: GameState,
  pressedKeys: Set<string>,
  dt: number,
): boolean {
  const direction = {
    x:
      Number(pressedKeys.has('d') || pressedKeys.has('arrowright')) -
      Number(pressedKeys.has('a') || pressedKeys.has('arrowleft')),
    y:
      Number(pressedKeys.has('s') || pressedKeys.has('arrowdown')) -
      Number(pressedKeys.has('w') || pressedKeys.has('arrowup')),
  };
  const normalized = normalize(direction);

  if (normalized.x === 0 && normalized.y === 0) return false;

  state.player.position = {
    x: clamp(
      state.player.position.x + normalized.x * state.player.speed * dt,
      state.player.size,
      state.world.width - state.player.size,
    ),
    y: clamp(
      state.player.position.y + normalized.y * state.player.speed * dt,
      state.player.size,
      state.world.height - state.player.size,
    ),
  };

  return true;
}

function updateMouseMovement(
  state: GameState,
  pointerTarget: Vector2 | null,
  dt: number,
): void {
  if (!pointerTarget) return;

  const nextPosition = moveTowards(
    state.player.position,
    pointerTarget,
    state.player.speed * 1.18 * dt,
  );
  state.player.position = {
    x: clamp(
      nextPosition.x,
      state.player.size,
      state.world.width - state.player.size,
    ),
    y: clamp(
      nextPosition.y,
      state.player.size,
      state.world.height - state.player.size,
    ),
  };
}

function updateEnemies(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    enemy.position = moveTowards(
      enemy.position,
      enemy.target,
      enemy.speed * dt,
    );

    if (
      Math.hypot(
        enemy.position.x - enemy.target.x,
        enemy.position.y - enemy.target.y,
      ) < 4
    ) {
      enemy.target = randomPoint(state.world, 48);
    }
  }
}

function collectFood(state: GameState): void {
  const playerCircle = {
    position: state.player.position,
    size: state.player.size,
  };

  state.foods = state.foods.filter((food) => {
    const collected = circlesOverlap(playerCircle, food, state.player.eatRange);
    if (collected) state.player.xp += FOOD_XP;
    return !collected;
  });
}

function resolveEnemyCollision(state: GameState, time: number): void {
  const playerCircle = {
    position: state.player.position,
    size: state.player.size,
  };
  const survivingEnemies: Enemy[] = [];

  for (const enemy of state.enemies) {
    if (!circlesOverlap(playerCircle, enemy, state.player.eatRange)) {
      survivingEnemies.push(enemy);
      continue;
    }

    if (canEat(state.player.size, enemy.size)) {
      state.player.xp += getEnemyXp(enemy.size);
      continue;
    }

    survivingEnemies.push(enemy);

    if (time - state.lastDamageAt < DAMAGE_COOLDOWN_MS) continue;

    const escapeVector = normalize({
      x: state.player.position.x - enemy.position.x,
      y: state.player.position.y - enemy.position.y,
    });
    state.player.hp = Math.max(
      0,
      state.player.hp - getDamageFromEnemy(enemy.size),
    );
    state.player.position = {
      x: clamp(
        state.player.position.x + escapeVector.x * 42,
        state.player.size,
        state.world.width - state.player.size,
      ),
      y: clamp(
        state.player.position.y + escapeVector.y * 42,
        state.player.size,
        state.world.height - state.player.size,
      ),
    };
    enemy.target = randomPoint(state.world, 48);
    state.lastDamageAt = time;

    if (state.player.hp <= 0) {
      state.phase = 'game-over';
      break;
    }
  }

  state.enemies = survivingEnemies;
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  position: Vector2,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
): Viewport {
  const viewport = calculateViewport(canvas, state);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(viewport.offsetX, viewport.offsetY);
  ctx.scale(viewport.scale, viewport.scale);
  ctx.translate(-viewport.left, -viewport.top);

  const worldGradient = ctx.createLinearGradient(
    0,
    0,
    state.world.width,
    state.world.height,
  );
  worldGradient.addColorStop(0, '#dff8eb');
  worldGradient.addColorStop(0.55, '#bfead9');
  worldGradient.addColorStop(1, '#9fd8d3');
  ctx.fillStyle = worldGradient;
  ctx.fillRect(0, 0, state.world.width, state.world.height);

  ctx.strokeStyle = 'rgba(23, 78, 74, 0.18)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, state.world.width - 4, state.world.height - 4);

  for (const food of state.foods) {
    drawCircle(
      ctx,
      food.position,
      food.size,
      '#34c759',
      'rgba(255, 255, 255, 0.78)',
    );
  }

  for (const enemy of state.enemies) {
    const dangerous = enemy.size >= state.player.size;
    drawCircle(
      ctx,
      enemy.position,
      enemy.size,
      dangerous ? '#ef4444' : '#fb7185',
      'rgba(126, 20, 20, 0.34)',
    );
    drawCircle(
      ctx,
      {
        x: enemy.position.x - enemy.size * 0.28,
        y: enemy.position.y - enemy.size * 0.18,
      },
      enemy.size * 0.13,
      'rgba(255,255,255,0.75)',
    );
    drawCircle(
      ctx,
      {
        x: enemy.position.x + enemy.size * 0.28,
        y: enemy.position.y - enemy.size * 0.18,
      },
      enemy.size * 0.13,
      'rgba(255,255,255,0.75)',
    );
  }

  const player = state.player;
  drawCircle(
    ctx,
    player.position,
    player.size + player.eatRange,
    'rgba(52, 211, 153, 0.15)',
    'rgba(16, 185, 129, 0.25)',
  );
  drawCircle(
    ctx,
    player.position,
    player.size,
    '#38bdf8',
    'rgba(3, 105, 161, 0.55)',
  );
  drawCircle(
    ctx,
    {
      x: player.position.x - player.size * 0.26,
      y: player.position.y - player.size * 0.22,
    },
    player.size * 0.16,
    'rgba(255,255,255,0.88)',
  );
  drawCircle(
    ctx,
    {
      x: player.position.x + player.size * 0.26,
      y: player.position.y - player.size * 0.22,
    },
    player.size * 0.16,
    'rgba(255,255,255,0.88)',
  );

  ctx.restore();
  return viewport;
}

export default function CellEvolutionGame(): React.ReactElement {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const viewportRef = useRef<Viewport>({
    scale: 1,
    left: 0,
    top: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const pointerTargetRef = useRef<Vector2 | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastHudSyncRef = useRef(0);
  const [snapshot, setSnapshot] = useState<HudSnapshot>(() =>
    createSnapshot(stateRef.current),
  );

  const xpProgress = useMemo(
    () => getLevelProgress(snapshot.player.xp, snapshot.player.xpToNext),
    [snapshot.player.xp, snapshot.player.xpToNext],
  );

  const syncSnapshot = useCallback(() => {
    setSnapshot(createSnapshot(stateRef.current));
  }, []);

  const reset = useCallback(() => {
    stateRef.current = createInitialState();
    pointerTargetRef.current = null;
    pressedKeysRef.current.clear();
    syncSnapshot();
  }, [syncSnapshot]);

  const applyUpgrade = useCallback(
    (upgrade: UpgradeId) => {
      const state = stateRef.current;
      if (state.phase !== 'level-up') return;

      state.player = {
        ...state.player,
        ...applyLevelUpUpgrade(state.player, upgrade),
      };
      state.phase = 'running';
      syncSnapshot();
    },
    [syncSnapshot],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (!KEYBOARD_KEYS.has(key)) return;

      event.preventDefault();
      pointerTargetRef.current = null;
      pressedKeysRef.current.add(key);
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      pressedKeysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const resizeCanvas = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor(parent.clientWidth * dpr));
      const height = Math.max(260, Math.floor(parent.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${Math.floor(width / dpr)}px`;
      canvas.style.height = `${Math.floor(height / dpr)}px`;
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
    resizeCanvas();

    const loop = (time: number): void => {
      const state = stateRef.current;
      const previousFrame = lastFrameRef.current || time;
      const dt = Math.min(0.05, (time - previousFrame) / 1000);
      lastFrameRef.current = time;

      if (state.phase === 'running') {
        ensureSpawns(state);
        const usedKeyboard = updateKeyboardMovement(
          state,
          pressedKeysRef.current,
          dt,
        );
        if (!usedKeyboard)
          updateMouseMovement(state, pointerTargetRef.current, dt);
        updateEnemies(state, dt);
        collectFood(state);
        resolveEnemyCollision(state, time);

        if (
          state.phase === 'running' &&
          state.player.xp >= state.player.xpToNext
        ) {
          state.phase = 'level-up';
          pointerTargetRef.current = null;
          syncSnapshot();
        }
      }

      viewportRef.current = drawGame(context, canvas, state);

      if (time - lastHudSyncRef.current > 120) {
        lastHudSyncRef.current = time;
        syncSnapshot();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [syncSnapshot]);

  const onPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    const canvas = canvasRef.current;
    if (!canvas || stateRef.current.phase !== 'running') return;

    pointerTargetRef.current = screenToWorld(
      canvas,
      viewportRef.current,
      event.clientX,
      event.clientY,
    );
  };

  const onPointerLeave = (): void => {
    pointerTargetRef.current = null;
  };

  return (
    <div
      className="cell-evolution-root"
      role="group"
      aria-label={t('cellEvolution.groupAria')}
    >
      <div className="cell-evolution-header">
        <div>
          <p className="cell-evolution-eyebrow">{t('cellEvolution.eyebrow')}</p>
          <h2>{t('cellEvolution.title')}</h2>
          <p>{t('cellEvolution.subtitle')}</p>
        </div>
        <button type="button" onClick={reset}>
          {t('cellEvolution.restart')}
        </button>
      </div>

      <div className="cell-evolution-hud" aria-live="polite">
        <span>
          {t('cellEvolution.level', { level: snapshot.player.level })}
        </span>
        <span>
          {t('cellEvolution.hp', {
            hp: Math.ceil(snapshot.player.hp),
            maxHp: snapshot.player.maxHp,
          })}
        </span>
        <span>
          {t('cellEvolution.size', { size: Math.round(snapshot.player.size) })}
        </span>
        <span>
          {t('cellEvolution.speed', {
            speed: Math.round(snapshot.player.speed),
          })}
        </span>
      </div>

      <div
        className="cell-evolution-xp"
        aria-label={t('cellEvolution.xpLabel', {
          xp: snapshot.player.xp,
          xpToNext: snapshot.player.xpToNext,
        })}
      >
        <div style={{ width: `${xpProgress * 100}%` }} />
      </div>

      <div className="cell-evolution-arena-wrap">
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          aria-label={t('cellEvolution.canvasAria')}
        />

        {snapshot.phase === 'level-up' && (
          <div
            className="cell-evolution-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={t('cellEvolution.levelUp')}
          >
            <div className="cell-evolution-card">
              <p className="cell-evolution-eyebrow">
                {t('cellEvolution.levelUp')}
              </p>
              <h3>{t('cellEvolution.chooseUpgrade')}</h3>
              <div className="cell-evolution-upgrades">
                {UPGRADES.map((upgrade) => (
                  <button
                    key={upgrade.id}
                    type="button"
                    onClick={() => applyUpgrade(upgrade.id)}
                  >
                    <strong>{t(upgrade.titleKey)}</strong>
                    <span>{t(upgrade.descriptionKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {snapshot.phase === 'game-over' && (
          <div
            className="cell-evolution-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={t('cellEvolution.gameOver')}
          >
            <div className="cell-evolution-card">
              <p className="cell-evolution-eyebrow">
                {t('cellEvolution.finalLevel', {
                  level: snapshot.player.level,
                })}
              </p>
              <h3>{t('cellEvolution.gameOver')}</h3>
              <p>{t('cellEvolution.gameOverText')}</p>
              <button type="button" onClick={reset}>
                {t('cellEvolution.restart')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="cell-evolution-help">
        {t('cellEvolution.help', {
          food: snapshot.foodCount,
          enemies: snapshot.enemyCount,
        })}
      </div>
    </div>
  );
}
