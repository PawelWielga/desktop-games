import { describe, expect, it } from "vitest";
import { DEFAULT_TRACK, createInitialCar, sampleHeight, sampleSurface, stepCar } from "./generally.logic";

describe("generally driving model", () => {
  it("accelerates the car on asphalt", () => {
    const car = createInitialCar("p1", "Player", "#f00", 0, "player");
    const next = stepCar(car, { throttle: 1, brake: 0, steer: 0 }, 1 / 30);
    expect(Math.hypot(next.velocity.x, next.velocity.z)).toBeGreaterThan(0.1);
  });

  it("samples different terrain surfaces from the track", () => {
    expect(sampleSurface(DEFAULT_TRACK, 20, 15).id).toBe("asphalt");
    expect(sampleSurface(DEFAULT_TRACK, 0, 0).id).toBe("grass");
  });

  it("keeps the car on the generated heightmap after landing", () => {
    const car = createInitialCar("p1", "Player", "#f00", 0, "player");
    const next = stepCar({ ...car, position: { ...car.position, y: car.position.y + 2 }, velocity: { x: 0, y: -8, z: 0 }, airborne: true }, { throttle: 0, brake: 0, steer: 0 }, 1 / 5);
    expect(next.position.y).toBeGreaterThanOrEqual(sampleHeight(DEFAULT_TRACK, next.position.x, next.position.z));
  });
});
