import { mulberry32 } from "./geo";
import { TOYOTA_GRAPEVINE } from "./toyota-lot";
import { seedHubKeys } from "./hubs";
import type { Asset, Geofence, InventoryAge, LngLat } from "./types";

/** Demo data: Toyota of Grapevine (701 E State Hwy 114, Grapevine, TX), its vehicles and keys. */

const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

export function seedAssets(): Asset[] {
  return seedToyotaAssets();
}

const TOYOTA_MODELS: [string, number][] = [
  ["Camry", 28400], ["RAV4", 31900], ["Tacoma", 37800], ["Tundra", 52300], ["Highlander", 41200],
  ["Corolla", 23100], ["4Runner", 44100], ["Sienna", 40900], ["Grand Highlander", 47600], ["Prius", 29600],
];

/** ~2.75 m stall width: neighbours are parked door to door. */
const STALL_M = 2.75;

/** ~100 vehicles parked across the traced rows at Toyota of Grapevine, in realistic runs and gaps. */
export function seedToyotaAssets(): Asset[] {
  const rand = mulberry32(114);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const lot = TOYOTA_GRAPEVINE;
  const kx = 111_320 * Math.cos((lot.rows[0][0][1] * Math.PI) / 180);
  const ky = 110_574;
  const out: Asset[] = [];

  // Every stall along the traced rows: all on pavement, inside the geofence, outside the building.
  const stalls: { r: number; i: number; n: number; position: LngLat }[] = [];
  lot.rows.forEach(([a, b], r) => {
    const len = Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky);
    const n = Math.floor(len / STALL_M) + 1;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      stalls.push({ r, i, n, position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] });
    }
  });

  // Park ~100 cars the way lots fill up: runs of 1-6 side by side with gaps between runs,
  // spread across every part of the lot.
  const TARGET = 100;
  const taken = new Set<string>();
  const slot = (r: number, i: number) => `${r}:${i}`;
  const free = (r: number, i: number, n: number) => i < 0 || i >= n || !taken.has(slot(r, i));
  const parked: (typeof stalls)[number][] = [];
  for (let guard = 0; parked.length < TARGET && guard < 5000; guard++) {
    const start = stalls[Math.floor(rand() * stalls.length)];
    const run = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6][Math.floor(rand() * 10)];
    // Leave an empty stall before and after each run so groups read as separate.
    if (!free(start.r, start.i - 1, start.n)) continue;
    for (let k = 0; k < run && parked.length < TARGET; k++) {
      const i = start.i + k;
      if (i >= start.n || taken.has(slot(start.r, i)) || !free(start.r, i + 1, start.n)) break;
      taken.add(slot(start.r, i));
      parked.push(stalls.find((s) => s.r === start.r && s.i === i)!);
    }
  }

  // Equal split of inventory age (green / yellow / red), shuffled so colors mix across the lot.
  const ages: InventoryAge[] = parked.map((_, n) => (["new", "mid", "old"] as const)[n % 3]);
  for (let n = ages.length - 1; n > 0; n--) {
    const m = Math.floor(rand() * (n + 1));
    [ages[n], ages[m]] = [ages[m], ages[n]];
  }

  parked.forEach(({ r, i, position }, n) => {
    const age = ages[n];
    const [model, base] = pick(TOYOTA_MODELS);
    const isNew = age === "new";
    const vin = Array.from({ length: 17 }, () => pick([...VIN_CHARS])).join("");
    out.push({
      id: `tgv-v-${r}-${i}`,
      typeId: `vehicle-${age}`,
      position,
      reporting: rand() > 0.08,
      year: isNew ? 2026 : 2019 + Math.floor(rand() * 6),
      make: "Toyota",
      model,
      vin,
      stock: vin.slice(-7),
      condition: isNew ? "New" : "Preowned",
      price: Math.round((base * (isNew ? 1 : 0.65 + rand() * 0.25)) / 5) * 5,
      miles: isNew ? Math.floor(rand() * 25) : 9000 + Math.floor(rand() * 70000),
      noImage: rand() < 0.08,
    });
  });

  // Keys live in the building's key locations, in vehicles on the lot, or off the lot.
  out.push(...seedHubKeys(out));
  return out;
}

export function seedToyotaGeofence(): Geofence {
  return { id: "lot-toyota-grapevine", name: TOYOTA_GRAPEVINE.name, address: TOYOTA_GRAPEVINE.address, visible: true, points: TOYOTA_GRAPEVINE.fence };
}

export function seedGeofences(): Geofence[] {
  return [seedToyotaGeofence()];
}
