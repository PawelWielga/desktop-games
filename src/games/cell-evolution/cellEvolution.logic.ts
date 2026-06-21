export type Vector2 = {
  x: number;
  y: number;
};

export type CircleEntity = {
  position: Vector2;
  size: number;
};

export type UpgradeId = 'speed' | 'hp' | 'reach';

export type PlayerStats = {
  speed: number;
  size: number;
  eatRange: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  level: number;
};

const BASE_SIZE_GROWTH = 1.15;
const SPEED_UPGRADE_MULTIPLIER = 1.2;
const HP_UPGRADE_MULTIPLIER = 1.2;
const REACH_SIZE_MULTIPLIER = 1.12;
const XP_REQUIREMENT_MULTIPLIER = 1.55;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(vector: Vector2): Vector2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { x: 0, y: 0 };

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function moveTowards(
  current: Vector2,
  target: Vector2,
  maxDistance: number,
): Vector2 {
  const toTarget = {
    x: target.x - current.x,
    y: target.y - current.y,
  };
  const length = Math.hypot(toTarget.x, toTarget.y);

  if (length <= maxDistance || length === 0) return target;

  return {
    x: current.x + (toTarget.x / length) * maxDistance,
    y: current.y + (toTarget.y / length) * maxDistance,
  };
}

export function circlesOverlap(
  a: CircleEntity,
  b: CircleEntity,
  extraRange = 0,
): boolean {
  return distance(a.position, b.position) <= a.size + b.size + extraRange;
}

export function canEat(playerSize: number, enemySize: number): boolean {
  return playerSize > enemySize;
}

export function getEnemyXp(enemySize: number): number {
  return Math.max(4, Math.round(enemySize / 3));
}

export function getDamageFromEnemy(enemySize: number): number {
  return Math.max(8, Math.round(enemySize / 2));
}

export function getLevelProgress(xp: number, xpToNext: number): number {
  if (xpToNext <= 0) return 1;

  return clamp(xp / xpToNext, 0, 1);
}

export function applyLevelUpUpgrade(
  stats: PlayerStats,
  upgrade: UpgradeId,
): PlayerStats {
  const leveledStats: PlayerStats = {
    ...stats,
    level: stats.level + 1,
    xp: Math.max(0, stats.xp - stats.xpToNext),
    xpToNext: Math.ceil(stats.xpToNext * XP_REQUIREMENT_MULTIPLIER),
    size: stats.size * BASE_SIZE_GROWTH,
  };

  switch (upgrade) {
    case 'speed':
      return {
        ...leveledStats,
        speed: leveledStats.speed * SPEED_UPGRADE_MULTIPLIER,
      };

    case 'hp': {
      const maxHp = Math.ceil(leveledStats.maxHp * HP_UPGRADE_MULTIPLIER);
      return {
        ...leveledStats,
        hp: maxHp,
        maxHp,
      };
    }

    case 'reach':
      return {
        ...leveledStats,
        eatRange: leveledStats.eatRange + 8,
        size: leveledStats.size * REACH_SIZE_MULTIPLIER,
      };
  }
}
