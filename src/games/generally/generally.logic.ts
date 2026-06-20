export type Vec3 = { x: number; y: number; z: number };
export type SurfaceId = "asphalt" | "grass" | "sand" | "gravel" | "mud" | "ice";
export type SurfaceDefinition = { id: SurfaceId; name: string; acceleration: number; braking: number; grip: number; drift: number; drag: number };
export type VehicleDefinition = { id: string; name: string; mass: number; enginePower: number; grip: number; maxSpeed: number; brakePower: number };
export type RaceInput = { throttle: number; brake: number; steer: number };
export type RaceMode = "singleplayer" | "timeTrial" | "hotSeat" | "online";
export type CarController = "player" | "remote";
export type TrackDecoration = { id: string; kind: "tree" | "tyres" | "post" | "building"; position: Vec3; radius: number };
export type TrackDefinition = { id: string; name: string; width: number; depth: number; heightMap: number[][]; surfaceMap: SurfaceId[][]; start: Vec3; startYaw: number; finishLineZ: number; waypoints: Vec3[]; decorations: TrackDecoration[] };
export type CarState = { id: string; name: string; color: string; controller: CarController; position: Vec3; velocity: Vec3; yaw: number; angularVelocity: number; airborne: boolean; lap: number; checkpoint: number; currentLapTime: number; bestLapTime: number | null; raceTime: number; finished: boolean };
export type RaceState = { cars: CarState[]; totalLaps: number; elapsed: number; started: boolean; mode: RaceMode };
export type GenerallyNetworkSnapshot = { id: string; position: Vec3; velocity: Vec3; yaw: number; airborne: boolean; lap: number; checkpoint: number; finished: boolean; sentAt: number };
const GRAVITY = 24, CAR_RADIUS = 1.15, CAR_RESTITUTION = 0.35, CHECKPOINT_RADIUS = 7.5, FINISH_RADIUS = 5.5, MAX_DT = 1 / 30;
export const SURFACES: Record<SurfaceId, SurfaceDefinition> = {
  asphalt: { id: "asphalt", name: "Asfalt", acceleration: 1, braking: 1, grip: 1, drift: 0.08, drag: 0.55 },
  grass: { id: "grass", name: "Trawa", acceleration: 0.74, braking: 0.82, grip: 0.68, drift: 0.2, drag: 1.35 },
  sand: { id: "sand", name: "Piasek", acceleration: 0.58, braking: 0.92, grip: 0.52, drift: 0.28, drag: 2.1 },
  gravel: { id: "gravel", name: "Żwir", acceleration: 0.82, braking: 0.86, grip: 0.74, drift: 0.22, drag: 1.05 },
  mud: { id: "mud", name: "Błoto", acceleration: 0.48, braking: 0.6, grip: 0.42, drift: 0.36, drag: 2.8 },
  ice: { id: "ice", name: "Lód", acceleration: 0.7, braking: 0.35, grip: 0.18, drift: 0.74, drag: 0.3 },
};
export const DEFAULT_VEHICLE: VehicleDefinition = { id: "mini-formula", name: "Mini Formula", mass: 720, enginePower: 28, grip: 1, maxSpeed: 38, brakePower: 36 };
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const length2d = (v: Vec3) => Math.hypot(v.x, v.z);
const normalize2d = (v: Vec3): Vec3 => { const len = length2d(v); return len > 0.0001 ? { x: v.x / len, y: 0, z: v.z / len } : { x: 0, y: 0, z: 0 }; };
const dot2d = (a: Vec3, b: Vec3) => a.x * b.x + a.z * b.z;
function makeHeightMap(cols: number, rows: number): number[][] {
  return Array.from({ length: rows }, (_, z) =>
    Array.from({ length: cols }, (_, x) => {
      const nx = x / (cols - 1) - 0.5;
      const nz = z / (rows - 1) - 0.5;
      const ridgeLeft = Math.exp(-((nx + 0.34) ** 2) * 55 - ((nz - 0.02) ** 2) * 3) * 5.3;
      const ridgeRight = Math.exp(-((nx - 0.3) ** 2) * 40 - ((nz + 0.08) ** 2) * 5) * 4.2;
      const valley = Math.exp(-((nx + 0.02) ** 2) * 9 - ((nz + 0.02) ** 2) * 14) * -3.8;
      const northBowl = Math.exp(-((nx - 0.05) ** 2 + (nz + 0.34) ** 2) * 30) * -2.2;
      const southHill = Math.exp(-((nx - 0.12) ** 2 + (nz - 0.33) ** 2) * 24) * 3.6;
      const jump = Math.exp(-((nx + 0.11) ** 2) * 120 - ((nz - 0.03) ** 2) * 34) * 2.8;
      const noise = Math.sin(x * 0.38) * 0.25 + Math.cos(z * 0.43) * 0.25 + Math.sin((x + z) * 0.18) * 0.2;
      return Number((ridgeLeft + ridgeRight + valley + northBowl + southHill + jump + noise).toFixed(3));
    })
  );
}

function isInsideRotatedEllipse(x: number, z: number, cx: number, cz: number, rx: number, rz: number, rotation: number): boolean {
  const dx = x - cx;
  const dz = z - cz;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  return (localX / rx) ** 2 + (localZ / rz) ** 2 <= 1;
}

function isOnRoad(worldX: number, worldZ: number, width: number, depth: number): boolean {
  const x = worldX / (width / 2);
  const z = worldZ / (depth / 2);
  const outerLoop = (x / 0.82) ** 2 + (z / 0.72) ** 2 < 1;
  const innerLake = (x / 0.43) ** 2 + (z / 0.31) ** 2 < 1;
  const westHairpin = isInsideRotatedEllipse(x, z, -0.45, 0.02, 0.23, 0.36, -0.45);
  const eastHairpin = isInsideRotatedEllipse(x, z, 0.46, -0.05, 0.26, 0.32, 0.45);
  const centralBridge = Math.abs(x) < 0.13 && z > -0.55 && z < 0.42;
  const southernS = isInsideRotatedEllipse(x, z, -0.08, 0.46, 0.48, 0.16, 0.16);
  return (outerLoop && !innerLake) || westHairpin || eastHairpin || centralBridge || southernS;
}

function surfaceForWorld(worldX: number, worldZ: number, width: number, depth: number): SurfaceId {
  const x = worldX / (width / 2);
  const z = worldZ / (depth / 2);
  if (isOnRoad(worldX, worldZ, width, depth)) {
    if (z < -0.52 || x > 0.56) return "gravel";
    if (Math.abs(x) < 0.14 && z > -0.46 && z < 0.38) return "asphalt";
    return "asphalt";
  }
  if (isInsideRotatedEllipse(x, z, -0.13, -0.05, 0.29, 0.19, -0.1)) return "sand";
  if (isInsideRotatedEllipse(x, z, 0.24, 0.25, 0.19, 0.15, 0.4)) return "mud";
  if (isInsideRotatedEllipse(x, z, -0.49, -0.27, 0.17, 0.13, -0.3)) return "ice";
  if (Math.abs(x) > 0.86 || Math.abs(z) > 0.76) return "sand";
  return "grass";
}

function makeSurfaceMap(cols: number, rows: number, width: number, depth: number): SurfaceId[][] {
  return Array.from({ length: rows }, (_, z) =>
    Array.from({ length: cols }, (_, x) => {
      const worldX = (x / (cols - 1) - 0.5) * width;
      const worldZ = (z / (rows - 1) - 0.5) * depth;
      return surfaceForWorld(worldX, worldZ, width, depth);
    })
  );
}

export const DEFAULT_TRACK: TrackDefinition = (() => {
  const width = 104;
  const depth = 78;
  const cols = 80;
  const rows = 60;
  return {
    id: "hidden-valley-inspired",
    name: "Hidden Valley Sprint",
    width,
    depth,
    heightMap: makeHeightMap(cols, rows),
    surfaceMap: makeSurfaceMap(cols, rows, width, depth),
    start: { x: -4, y: 0, z: 28 },
    startYaw: Math.PI,
    finishLineZ: 28,
    waypoints: [
      { x: -24, y: 0, z: 26 },
      { x: -43, y: 0, z: 9 },
      { x: -36, y: 0, z: -17 },
      { x: -10, y: 0, z: -32 },
      { x: 26, y: 0, z: -30 },
      { x: 45, y: 0, z: -8 },
      { x: 32, y: 0, z: 17 },
      { x: 5, y: 0, z: 6 },
      { x: -2, y: 0, z: -18 },
      { x: -6, y: 0, z: 24 },
    ],
    decorations: [
      { id: "tree-1", kind: "tree", position: { x: -47, y: 0, z: 30 }, radius: 2.3 },
      { id: "tree-2", kind: "tree", position: { x: -37, y: 0, z: 31 }, radius: 2.3 },
      { id: "tree-3", kind: "tree", position: { x: 42, y: 0, z: 27 }, radius: 2.3 },
      { id: "tree-4", kind: "tree", position: { x: 48, y: 0, z: 8 }, radius: 2.3 },
      { id: "tree-5", kind: "tree", position: { x: -46, y: 0, z: -25 }, radius: 2.3 },
      { id: "tree-6", kind: "tree", position: { x: 19, y: 0, z: -34 }, radius: 2.3 },
      { id: "tyres-1", kind: "tyres", position: { x: -12, y: 0, z: 28 }, radius: 2.4 },
      { id: "tyres-2", kind: "tyres", position: { x: 12, y: 0, z: 27 }, radius: 2.4 },
      { id: "tyres-3", kind: "tyres", position: { x: 7, y: 0, z: 3 }, radius: 2.5 },
      { id: "post-1", kind: "post", position: { x: -18, y: 0, z: -3 }, radius: 1.2 },
      { id: "post-2", kind: "post", position: { x: 18, y: 0, z: -2 }, radius: 1.2 },
      { id: "building-1", kind: "building", position: { x: 37, y: 0, z: -28 }, radius: 4.2 },
    ],
  };
})();

export function sampleHeight(track: TrackDefinition, x: number, z: number): number { const rows = track.heightMap.length, cols = track.heightMap[0]?.length ?? 0; const u = clamp((x / track.width + 0.5) * (cols - 1), 0, cols - 1), v = clamp((z / track.depth + 0.5) * (rows - 1), 0, rows - 1); const x0 = Math.floor(u), z0 = Math.floor(v), x1 = Math.min(x0 + 1, cols - 1), z1 = Math.min(z0 + 1, rows - 1); const tx = u - x0, tz = v - z0; return lerp(lerp(track.heightMap[z0][x0], track.heightMap[z0][x1], tx), lerp(track.heightMap[z1][x0], track.heightMap[z1][x1], tx), tz); }
export function sampleSurface(track: TrackDefinition, x: number, z: number): SurfaceDefinition { const rows = track.surfaceMap.length, cols = track.surfaceMap[0]?.length ?? 0; const ix = clamp(Math.round((x / track.width + 0.5) * (cols - 1)), 0, cols - 1), iz = clamp(Math.round((z / track.depth + 0.5) * (rows - 1)), 0, rows - 1); return SURFACES[track.surfaceMap[iz][ix]]; }
export function sampleSlope(track: TrackDefinition, x: number, z: number): Vec3 { return { x: sampleHeight(track, x + 0.5, z) - sampleHeight(track, x - 0.5, z), y: 0, z: sampleHeight(track, x, z + 0.5) - sampleHeight(track, x, z - 0.5) }; }
export function createInitialCar(id: string, name: string, color: string, offset: number, controller: CarController): CarState { const ground = sampleHeight(DEFAULT_TRACK, DEFAULT_TRACK.start.x + offset, DEFAULT_TRACK.start.z); return { id, name, color, controller, position: { x: DEFAULT_TRACK.start.x + offset, y: ground, z: DEFAULT_TRACK.start.z }, velocity: { x: 0, y: 0, z: 0 }, yaw: DEFAULT_TRACK.startYaw, angularVelocity: 0, airborne: false, lap: 1, checkpoint: 0, currentLapTime: 0, bestLapTime: null, raceTime: 0, finished: false }; }
export function createInitialRace(mode: RaceMode): RaceState { const cars = [createInitialCar("player-1", "Gracz 1", "#e53935", -2.2, "player")]; if (mode === "hotSeat") cars.push(createInitialCar("player-2", "Gracz 2", "#1e88e5", 2.2, "player")); return { cars, totalLaps: mode === "timeTrial" ? 1 : 3, elapsed: 0, started: true, mode }; }
function updateCarProgress(car: CarState, track: TrackDefinition, totalLaps: number): CarState { if (car.finished) return car; let next = { ...car }; const target = track.waypoints[next.checkpoint]; if (target && Math.hypot(next.position.x - target.x, next.position.z - target.z) < CHECKPOINT_RADIUS) next = { ...next, checkpoint: (next.checkpoint + 1) % track.waypoints.length }; const crossedFinish = next.checkpoint === 0 && Math.abs(next.position.z - track.finishLineZ) < FINISH_RADIUS && Math.abs(next.position.x - track.start.x) < 12 && length2d(next.velocity) > 3; if (crossedFinish && next.currentLapTime > 8) { const bestLapTime = next.bestLapTime === null ? next.currentLapTime : Math.min(next.bestLapTime, next.currentLapTime); const lap = next.lap + 1; next = { ...next, bestLapTime, lap, currentLapTime: 0, finished: lap > totalLaps }; } return next; }
function resolveObstacleCollision(car: CarState, track: TrackDefinition): CarState { let next = car; for (const obstacle of track.decorations) { const delta = { x: next.position.x - obstacle.position.x, y: 0, z: next.position.z - obstacle.position.z }; const distance = length2d(delta), minDistance = obstacle.radius + CAR_RADIUS; if (distance <= 0.001 || distance >= minDistance) continue; const normal = normalize2d(delta), push = minDistance - distance, velocityAlongNormal = dot2d(next.velocity, normal); next = { ...next, position: { ...next.position, x: next.position.x + normal.x * push, z: next.position.z + normal.z * push }, velocity: { ...next.velocity, x: next.velocity.x - (1 + CAR_RESTITUTION) * velocityAlongNormal * normal.x, z: next.velocity.z - (1 + CAR_RESTITUTION) * velocityAlongNormal * normal.z }, angularVelocity: next.angularVelocity * 0.55 }; } return next; }
export function stepCar(car: CarState, input: RaceInput, dt: number, track: TrackDefinition = DEFAULT_TRACK, vehicle: VehicleDefinition = DEFAULT_VEHICLE, totalLaps = 3): CarState { const safeDt = clamp(dt, 0, MAX_DT); if (car.finished) return car; const surface = sampleSurface(track, car.position.x, car.position.z), speed = length2d(car.velocity), forward = { x: Math.sin(car.yaw), y: 0, z: Math.cos(car.yaw) }, right = { x: Math.cos(car.yaw), y: 0, z: -Math.sin(car.yaw) }, forwardSpeed = dot2d(car.velocity, forward), sideSpeed = dot2d(car.velocity, right), slope = sampleSlope(track, car.position.x, car.position.z), grip = vehicle.grip * surface.grip * (car.airborne ? 0.08 : 1); const throttleForce = input.throttle * vehicle.enginePower * surface.acceleration, brakeForce = Math.sign(forwardSpeed || 1) * input.brake * vehicle.brakePower * surface.braking, slopeForce = { x: -slope.x * GRAVITY * 0.45, y: 0, z: -slope.z * GRAVITY * 0.45 }, dragForce = Math.min(speed, surface.drag * speed * speed * 0.018 + 0.02 * speed); const steerPower = clamp(speed / 15, 0.18, 1), wantedAngularVelocity = input.steer * steerPower * grip * 2.65, angularVelocity = lerp(car.angularVelocity, wantedAngularVelocity, clamp(safeDt * 6, 0, 1)), yaw = car.airborne ? car.yaw + angularVelocity * safeDt * 0.18 : car.yaw + angularVelocity * safeDt, lateralDamping = clamp(grip * (1 - surface.drift) * safeDt * 7.5, 0, 1); let velocity = { x: car.velocity.x + (forward.x * (throttleForce - brakeForce) + slopeForce.x) * safeDt - normalize2d(car.velocity).x * dragForce * safeDt - right.x * sideSpeed * lateralDamping, y: car.velocity.y, z: car.velocity.z + (forward.z * (throttleForce - brakeForce) + slopeForce.z) * safeDt - normalize2d(car.velocity).z * dragForce * safeDt - right.z * sideSpeed * lateralDamping }; const newSpeed = length2d(velocity); if (newSpeed > vehicle.maxSpeed) { const n = normalize2d(velocity); velocity = { ...velocity, x: n.x * vehicle.maxSpeed, z: n.z * vehicle.maxSpeed }; } let position = { x: clamp(car.position.x + velocity.x * safeDt, -track.width / 2 + 2, track.width / 2 - 2), y: car.position.y + velocity.y * safeDt, z: clamp(car.position.z + velocity.z * safeDt, -track.depth / 2 + 2, track.depth / 2 - 2) }; const ground = sampleHeight(track, position.x, position.z); let airborne = car.airborne; if (position.y > ground + 0.16 || velocity.y > 1.1) { airborne = true; velocity = { ...velocity, y: velocity.y - GRAVITY * safeDt }; } if (position.y <= ground) { const landingPenalty = airborne ? 0.88 : 1; position = { ...position, y: ground }; velocity = { x: velocity.x * landingPenalty, y: 0, z: velocity.z * landingPenalty }; airborne = false; } return updateCarProgress(resolveObstacleCollision({ ...car, position, velocity, yaw, angularVelocity, airborne, currentLapTime: car.currentLapTime + safeDt, raceTime: car.raceTime + safeDt }, track), track, totalLaps); }
export function createSnapshot(car: CarState, sentAt = Date.now()): GenerallyNetworkSnapshot { return { id: car.id, position: car.position, velocity: car.velocity, yaw: car.yaw, airborne: car.airborne, lap: car.lap, checkpoint: car.checkpoint, finished: car.finished, sentAt }; }
export function applyRemoteSnapshot(car: CarState, snapshot: GenerallyNetworkSnapshot, interpolation = 0.35): CarState { return { ...car, position: { x: lerp(car.position.x, snapshot.position.x, interpolation), y: lerp(car.position.y, snapshot.position.y, interpolation), z: lerp(car.position.z, snapshot.position.z, interpolation) }, velocity: snapshot.velocity, yaw: lerp(car.yaw, snapshot.yaw, interpolation), airborne: snapshot.airborne, lap: snapshot.lap, checkpoint: snapshot.checkpoint, finished: snapshot.finished }; }
