import { describe, expect, it } from "vitest";
import {
  createDesktopIconLayout,
  getRequiredColumns,
  hasOverlappingIconPositions,
  type DesktopIconGridDimensions,
} from "./desktopIconLayout";

const appIds = Array.from({ length: 12 }, (_, index) => `app-${index + 1}`);

const estimateGridDimensions = (viewportWidth: number, viewportHeight: number): DesktopIconGridDimensions => {
  const taskbarHeight = 48;
  const padding = 24;
  const iconColumn = 72;
  const iconRow = 72;
  const gap = 24;

  return {
    columns: Math.max(1, Math.floor((viewportWidth - padding * 2 - iconColumn) / (iconColumn + gap)) + 1),
    rowsPerColumn: Math.max(1, Math.floor((viewportHeight - taskbarHeight - padding * 2 - iconRow) / (iconRow + gap)) + 1),
  };
};

describe("desktop icon layout", () => {
  it.each([
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
  ])("keeps default icons visible and non-overlapping for %ix%i", (width, height) => {
    const gridDimensions = estimateGridDimensions(width, height);
    const layout = createDesktopIconLayout({ appIds, gridDimensions });

    expect(hasOverlappingIconPositions(layout)).toBe(false);
    expect(getRequiredColumns(appIds.length, gridDimensions)).toBeLessThanOrEqual(gridDimensions.columns);

    for (const position of Object.values(layout)) {
      expect(position.column).toBeGreaterThanOrEqual(0);
      expect(position.column).toBeLessThan(gridDimensions.columns);
      expect(position.row).toBeGreaterThanOrEqual(0);
      expect(position.row).toBeLessThan(gridDimensions.rowsPerColumn);
    }
  });

  it("fills a column from top to bottom before moving to the next one", () => {
    const layout = createDesktopIconLayout({
      appIds: ["a", "b", "c", "d", "e"],
      gridDimensions: { rowsPerColumn: 3, columns: 4 },
    });

    expect(layout).toEqual({
      a: { column: 0, row: 0 },
      b: { column: 0, row: 1 },
      c: { column: 0, row: 2 },
      d: { column: 1, row: 0 },
      e: { column: 1, row: 1 },
    });
  });

  it("keeps manual positions when they still fit the resized desktop", () => {
    const layout = createDesktopIconLayout({
      appIds: ["a", "b", "c"],
      storedLayout: {
        a: { column: 2, row: 1 },
        b: { column: 0, row: 0 },
      },
      gridDimensions: { rowsPerColumn: 4, columns: 4 },
    });

    expect(layout.a).toEqual({ column: 2, row: 1 });
    expect(layout.b).toEqual({ column: 0, row: 0 });
    expect(layout.c).toEqual({ column: 0, row: 1 });
    expect(hasOverlappingIconPositions(layout)).toBe(false);
  });

  it("reflows icons that no longer fit after resize instead of stacking them", () => {
    const layout = createDesktopIconLayout({
      appIds: ["a", "b", "c", "d", "e"],
      storedLayout: {
        a: { column: 0, row: 0 },
        b: { column: 0, row: 1 },
        c: { column: 0, row: 4 },
        d: { column: 3, row: 4 },
      },
      gridDimensions: { rowsPerColumn: 2, columns: 2 },
    });

    expect(hasOverlappingIconPositions(layout)).toBe(false);
    expect(layout).toEqual({
      a: { column: 0, row: 0 },
      b: { column: 0, row: 1 },
      c: { column: 1, row: 0 },
      d: { column: 1, row: 1 },
      e: { column: 2, row: 0 },
    });
  });
});
