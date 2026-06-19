export type DesktopIconPosition = {
  column: number;
  row: number;
};

export type DesktopIconLayout = Record<string, DesktopIconPosition>;

export type DesktopIconGridDimensions = {
  rowsPerColumn: number;
  columns: number;
};

export const getIconPositionKey = ({ column, row }: DesktopIconPosition): string => `${column}:${row}`;

export const normalizeGridDimensions = (
  dimensions: DesktopIconGridDimensions
): DesktopIconGridDimensions => ({
  rowsPerColumn: Math.max(1, Math.floor(dimensions.rowsPerColumn)),
  columns: Math.max(1, Math.floor(dimensions.columns)),
});

const isInsideGrid = (
  position: DesktopIconPosition,
  dimensions: DesktopIconGridDimensions
): boolean =>
  position.column >= 0 &&
  position.row >= 0 &&
  position.column < dimensions.columns &&
  position.row < dimensions.rowsPerColumn;

const clampPositionToGrid = (
  position: DesktopIconPosition,
  dimensions: DesktopIconGridDimensions
): DesktopIconPosition => ({
  column: Math.min(Math.max(position.column, 0), dimensions.columns - 1),
  row: Math.min(Math.max(position.row, 0), dimensions.rowsPerColumn - 1),
});

export const getDefaultIconPosition = (
  index: number,
  dimensions: Pick<DesktopIconGridDimensions, "rowsPerColumn">
): DesktopIconPosition => {
  const rowsPerColumn = Math.max(1, Math.floor(dimensions.rowsPerColumn));

  return {
    column: Math.floor(index / rowsPerColumn),
    row: index % rowsPerColumn,
  };
};

export const findFirstFreeIconPosition = (
  occupiedPositions: ReadonlySet<string>,
  dimensions: Pick<DesktopIconGridDimensions, "rowsPerColumn">
): DesktopIconPosition => {
  for (let index = 0; index <= occupiedPositions.size; index += 1) {
    const position = getDefaultIconPosition(index, dimensions);
    if (!occupiedPositions.has(getIconPositionKey(position))) return position;
  }

  return getDefaultIconPosition(occupiedPositions.size, dimensions);
};

export const isIconPosition = (value: unknown): value is DesktopIconPosition => {
  if (!value || typeof value !== "object") return false;

  const { column, row } = value as Partial<DesktopIconPosition>;
  return (
    Number.isInteger(column) &&
    Number.isInteger(row) &&
    typeof column === "number" &&
    typeof row === "number" &&
    column >= 0 &&
    row >= 0
  );
};

type CreateDesktopIconLayoutOptions = {
  appIds: string[];
  storedLayout?: DesktopIconLayout;
  gridDimensions: DesktopIconGridDimensions;
};

export const createDesktopIconLayout = ({
  appIds,
  storedLayout = {},
  gridDimensions,
}: CreateDesktopIconLayoutOptions): DesktopIconLayout => {
  const dimensions = normalizeGridDimensions(gridDimensions);
  const usedPositions = new Set<string>();

  return appIds.reduce<DesktopIconLayout>((layout, id) => {
    const storedPosition = storedLayout[id];
    const preferredPosition = storedPosition
      ? clampPositionToGrid(storedPosition, dimensions)
      : undefined;
    const preferredPositionKey = preferredPosition ? getIconPositionKey(preferredPosition) : undefined;

    const position =
      preferredPosition &&
      isInsideGrid(preferredPosition, dimensions) &&
      preferredPositionKey &&
      !usedPositions.has(preferredPositionKey)
        ? preferredPosition
        : findFirstFreeIconPosition(usedPositions, dimensions);

    layout[id] = position;
    usedPositions.add(getIconPositionKey(position));
    return layout;
  }, {});
};

export const getRequiredColumns = (
  iconCount: number,
  dimensions: Pick<DesktopIconGridDimensions, "rowsPerColumn">
): number => {
  const rowsPerColumn = Math.max(1, Math.floor(dimensions.rowsPerColumn));
  return Math.max(1, Math.ceil(iconCount / rowsPerColumn));
};

export const hasOverlappingIconPositions = (layout: DesktopIconLayout): boolean => {
  const positions = new Set<string>();

  return Object.values(layout).some((position) => {
    const key = getIconPositionKey(position);
    if (positions.has(key)) return true;
    positions.add(key);
    return false;
  });
};
