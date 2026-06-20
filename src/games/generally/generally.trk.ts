import { DEFAULT_TRACK, type SurfaceId, type TrackDefinition, type Vec3 } from "./generally.logic";

const TRK_SIGNATURE_OFFSET = 2;
const TRK_MAGIC = "GR";
const DEFAULT_IMPORT_GRID_SIZE = 64;
const MIN_TRACK_SIZE = 64;
const MAX_TRACK_SIZE = 1024;

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
};

export async function readGenerallyTrackFile(file: File): Promise<TrackDefinition> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const source = file.name.toLowerCase().endsWith(".zip") ? await extractFirstTrkFromZip(bytes) : { name: file.name, bytes };
  return parseGenerallyTrackBytes(source.bytes, source.name);
}

export function parseGenerallyTrackBytes(bytes: Uint8Array, fileName = "Imported.trk"): TrackDefinition {
  if (!isGenerallyTrk(bytes)) {
    throw new Error("Wybrany plik nie wygląda jak mapa GeneRally .TRK.");
  }

  const rawSize = readUint16(bytes, 0);
  const sourceSize = rawSize >= MIN_TRACK_SIZE && rawSize <= MAX_TRACK_SIZE ? rawSize : 288;
  const dataOffset = 6;
  const gridSize = DEFAULT_IMPORT_GRID_SIZE;
  const heightMap = createGrid(gridSize, gridSize, 0);
  const surfaceMap = createSurfaceGrid(gridSize, gridSize, "grass");

  for (let z = 0; z < gridSize; z += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const sourceX = Math.floor((x / Math.max(1, gridSize - 1)) * (sourceSize - 1));
      const sourceZ = Math.floor((z / Math.max(1, gridSize - 1)) * (sourceSize - 1));
      const sample = sampleTrkCell(bytes, dataOffset, sourceSize, sourceX, sourceZ);
      surfaceMap[z][x] = classifySurface(sample.surfaceValue);
      heightMap[z][x] = sample.height;
    }
  }

  smoothHeightMap(heightMap);

  const worldWidth = 92;
  const worldDepth = 68;
  const start = findStartPoint(surfaceMap, worldWidth, worldDepth);

  return {
    ...DEFAULT_TRACK,
    id: `trk-${sanitizeId(fileName)}`,
    name: stripExtension(fileName),
    width: worldWidth,
    depth: worldDepth,
    heightMap,
    surfaceMap,
    start,
    startYaw: Math.PI,
    finishLineZ: start.z,
    waypoints: createWaypointsFromSurface(surfaceMap, worldWidth, worldDepth),
    decorations: createDecorationsFromSurface(surfaceMap, worldWidth, worldDepth),
  };
}

function isGenerallyTrk(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    String.fromCharCode(bytes[TRK_SIGNATURE_OFFSET], bytes[TRK_SIGNATURE_OFFSET + 1]) === TRK_MAGIC
  );
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function sampleTrkCell(
  bytes: Uint8Array,
  dataOffset: number,
  sourceSize: number,
  sourceX: number,
  sourceZ: number
): { surfaceValue: number; height: number } {
  const index = sourceZ * sourceSize + sourceX;
  const wordOffset = dataOffset + index * 2;
  const byteOffset = dataOffset + index;
  const surfaceValue = wordOffset + 1 < bytes.length ? bytes[wordOffset] : bytes[byteOffset % bytes.length];
  const heightSeed = wordOffset + 1 < bytes.length ? bytes[wordOffset + 1] : bytes[(byteOffset + sourceSize * sourceSize) % bytes.length];
  const detail = bytes[(dataOffset + index * 3) % bytes.length] ?? 0;
  return {
    surfaceValue,
    height: ((heightSeed % 32) - 16) / 5 + ((detail % 17) - 8) / 18,
  };
}

function classifySurface(value: number): SurfaceId {
  if (value <= 7) return "ice";
  if (value >= 16 && value <= 31) return "asphalt";
  if (value >= 32 && value <= 55) return "grass";
  if (value >= 56 && value <= 95) return "gravel";
  if (value >= 96 && value <= 135) return "sand";
  if (value >= 136 && value <= 190) return "mud";
  return "grass";
}

function createWaypointsFromSurface(surfaceMap: SurfaceId[][], width: number, depth: number): Vec3[] {
  const roadPoints: Vec3[] = [];
  const rows = surfaceMap.length;
  const cols = surfaceMap[0]?.length ?? 0;

  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (surfaceMap[z][x] !== "asphalt" && surfaceMap[z][x] !== "gravel") continue;
      roadPoints.push(gridToWorld(x, z, cols, rows, width, depth));
    }
  }

  if (roadPoints.length < 24) return DEFAULT_TRACK.waypoints;

  const center = roadPoints.reduce<Vec3>(
    (acc, point) => ({ x: acc.x + point.x, y: 0, z: acc.z + point.z }),
    { x: 0, y: 0, z: 0 }
  );
  center.x /= roadPoints.length;
  center.z /= roadPoints.length;

  return Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 8;
    const direction = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    let best = roadPoints[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const point of roadPoints) {
      const score = (point.x - center.x) * direction.x + (point.z - center.z) * direction.z;
      if (score > bestScore) {
        best = point;
        bestScore = score;
      }
    }
    return { x: best.x, y: 0, z: best.z };
  });
}

function findStartPoint(surfaceMap: SurfaceId[][], width: number, depth: number): Vec3 {
  const rows = surfaceMap.length;
  const cols = surfaceMap[0]?.length ?? 0;
  for (let z = rows - 1; z >= 0; z -= 1) {
    for (let x = Math.floor(cols * 0.25); x < Math.floor(cols * 0.75); x += 1) {
      if (surfaceMap[z][x] === "asphalt" || surfaceMap[z][x] === "gravel") {
        return gridToWorld(x, z, cols, rows, width, depth);
      }
    }
  }
  return DEFAULT_TRACK.start;
}

function createDecorationsFromSurface(surfaceMap: SurfaceId[][], width: number, depth: number) {
  const rows = surfaceMap.length;
  const cols = surfaceMap[0]?.length ?? 0;
  const decorations = [];
  let counter = 0;

  for (let z = 4; z < rows; z += 12) {
    for (let x = 4; x < cols; x += 12) {
      if (surfaceMap[z][x] !== "grass" || counter >= 18) continue;
      const position = gridToWorld(x, z, cols, rows, width, depth);
      decorations.push({ id: `trk-tree-${counter}`, kind: "tree" as const, position, radius: 2.1 });
      counter += 1;
    }
  }

  return decorations.length > 0 ? decorations : DEFAULT_TRACK.decorations;
}

function gridToWorld(x: number, z: number, cols: number, rows: number, width: number, depth: number): Vec3 {
  return {
    x: (x / Math.max(1, cols - 1) - 0.5) * width,
    y: 0,
    z: (z / Math.max(1, rows - 1) - 0.5) * depth,
  };
}

function smoothHeightMap(heightMap: number[][]): void {
  const copy = heightMap.map((row) => row.slice());
  for (let z = 1; z < heightMap.length - 1; z += 1) {
    for (let x = 1; x < heightMap[z].length - 1; x += 1) {
      heightMap[z][x] =
        (copy[z][x] * 2 + copy[z - 1][x] + copy[z + 1][x] + copy[z][x - 1] + copy[z][x + 1]) / 6;
    }
  }
}

async function extractFirstTrkFromZip(bytes: Uint8Array): Promise<{ name: string; bytes: Uint8Array }> {
  let offset = 0;
  while (offset + 30 < bytes.length) {
    if (readUint32(bytes, offset) !== 0x04034b50) break;
    const entry = readZipEntry(bytes, offset);
    const nextOffset = entry.dataOffset + entry.compressedSize;
    if (entry.name.toLowerCase().endsWith(".trk")) {
      return { name: entry.name, bytes: await readZipEntryBytes(bytes, entry) };
    }
    offset = nextOffset;
  }
  throw new Error("Archiwum ZIP nie zawiera pliku .TRK.");
}

function readZipEntry(bytes: Uint8Array, offset: number): ZipEntry {
  const method = readUint16(bytes, offset + 8);
  const compressedSize = readUint32(bytes, offset + 18);
  const uncompressedSize = readUint32(bytes, offset + 22);
  const fileNameLength = readUint16(bytes, offset + 26);
  const extraLength = readUint16(bytes, offset + 28);
  const nameStart = offset + 30;
  const nameBytes = bytes.slice(nameStart, nameStart + fileNameLength);
  return {
    name: new TextDecoder().decode(nameBytes),
    method,
    compressedSize,
    uncompressedSize,
    dataOffset: nameStart + fileNameLength + extraLength,
  };
}

async function readZipEntryBytes(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const compressed = bytes.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method !== 8) throw new Error("Obsługiwane są tylko mapy ZIP zapisane metodą Store albo Deflate.");
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("Ta przeglądarka nie obsługuje rozpakowywania ZIP w aplikacji.");
  }

  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  await writer.write(compressed);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  const output = new Uint8Array(buffer);
  return entry.uncompressedSize > 0 ? output.slice(0, entry.uncompressedSize) : output;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function createGrid(cols: number, rows: number, value: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function createSurfaceGrid(cols: number, rows: number, value: SurfaceId): SurfaceId[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "").split(/[\\/]/).pop() ?? "Imported Track";
}

function sanitizeId(fileName: string): string {
  return stripExtension(fileName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "imported";
}
