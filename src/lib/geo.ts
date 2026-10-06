import type { LngLat } from "./types";

/** Ray-casting point-in-polygon test (polygon given as an open ring). */
export function pointInPolygon([x, y]: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(points: LngLat[]): LngLat {
  const n = points.length || 1;
  const [sx, sy] = points.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sx / n, sy / n];
}

export function closeRing(points: LngLat[]): LngLat[] {
  return points.length ? [...points, points[0]] : points;
}

/** Approximate polygon area in km² (equirectangular projection, fine for geofence sizes). */
export function areaKm2(points: LngLat[]): number {
  if (points.length < 3) return 0;
  const lat0 = (centroid(points)[1] * Math.PI) / 180;
  const kx = 111.32 * Math.cos(lat0);
  const ky = 110.57;
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += points[j][0] * kx * points[i][1] * ky - points[i][0] * kx * points[j][1] * ky;
  }
  return Math.abs(a / 2);
}

/** Small deterministic PRNG so seed data is stable between reloads. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Single-linkage grouping by real-world distance: items within `meters` of each
 * other (directly or through a chain of neighbours) end up in the same group.
 * Uses a spatial hash so it stays fast for thousands of points.
 */
export function groupByDistance<T extends { position: LngLat }>(items: T[], meters: number): T[][] {
  if (!items.length) return [];
  const ky = 110_574;
  const kx = 111_320 * Math.cos((items[0].position[1] * Math.PI) / 180);
  const xy = items.map(({ position: [lng, lat] }) => [lng * kx, lat * ky]);
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };

  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  xy.forEach(([x, y], i) => {
    const k = key(Math.floor(x / meters), Math.floor(y / meters));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  });

  const m2 = meters * meters;
  xy.forEach(([x, y], i) => {
    const cx = Math.floor(x / meters);
    const cy = Math.floor(y / meters);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(key(cx + dx, cy + dy)) ?? []) {
          if (j <= i) continue;
          const ex = xy[j][0] - x;
          const ey = xy[j][1] - y;
          if (ex * ex + ey * ey <= m2) parent[find(j)] = find(i);
        }
      }
    }
  });

  const groups = new Map<number, T[]>();
  items.forEach((item, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(item);
    else groups.set(root, [item]);
  });
  return [...groups.values()];
}
