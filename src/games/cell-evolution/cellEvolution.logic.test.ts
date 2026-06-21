import { describe, expect, it } from 'vitest';
import {
  applyLevelUpUpgrade,
  canEat,
  circlesOverlap,
  getLevelProgress,
  moveTowards,
  type PlayerStats,
} from './cellEvolution.logic';

const baseStats: PlayerStats = {
  speed: 120,
  size: 18,
  eatRange: 2,
  xp: 12,
  xpToNext: 10,
  hp: 80,
  maxHp: 100,
  level: 1,
};

describe('cell evolution logic', () => {
  it('detects circle overlap with optional eating range', () => {
    expect(
      circlesOverlap(
        { position: { x: 0, y: 0 }, size: 10 },
        { position: { x: 24, y: 0 }, size: 10 },
        5,
      ),
    ).toBe(true);

    expect(
      circlesOverlap(
        { position: { x: 0, y: 0 }, size: 10 },
        { position: { x: 26, y: 0 }, size: 10 },
        5,
      ),
    ).toBe(false);
  });

  it('moves towards a target without overshooting', () => {
    expect(moveTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)).toEqual({
      x: 4,
      y: 0,
    });
    expect(moveTowards({ x: 0, y: 0 }, { x: 3, y: 0 }, 4)).toEqual({
      x: 3,
      y: 0,
    });
  });

  it('compares sizes for eating enemies', () => {
    expect(canEat(22, 18)).toBe(true);
    expect(canEat(18, 22)).toBe(false);
  });

  it('applies speed upgrade and keeps xp overflow', () => {
    const upgraded = applyLevelUpUpgrade(baseStats, 'speed');

    expect(upgraded.level).toBe(2);
    expect(upgraded.xp).toBe(2);
    expect(upgraded.xpToNext).toBe(16);
    expect(upgraded.speed).toBeCloseTo(144);
    expect(upgraded.size).toBeCloseTo(20.7);
  });

  it('applies hp upgrade by increasing max hp and healing player', () => {
    const upgraded = applyLevelUpUpgrade(baseStats, 'hp');

    expect(upgraded.maxHp).toBe(120);
    expect(upgraded.hp).toBe(120);
  });

  it('normalizes level progress to range from zero to one', () => {
    expect(getLevelProgress(5, 10)).toBe(0.5);
    expect(getLevelProgress(50, 10)).toBe(1);
  });
});
