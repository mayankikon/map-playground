import { mulberry32 } from "./geo";
import type { Asset, Geofence, InventoryAge, LngLat } from "./types";

/** Demo data around Grapevine, TX (the address used in the Figma previews). */

interface Lot {
  name: string;
  address: string;
  center: LngLat;
  half: [number, number];
  vehicles: number;
  keys: number;
  devices: number;
}

const LOTS: Lot[] = [
  { name: "Classic Chevrolet", address: "1101 W State Hwy 114, Grapevine, TX 76051", center: [-97.0975, 32.9395], half: [0.0032, 0.0019], vehicles: 34, keys: 7, devices: 2 },
  { name: "Overflow Lot B", address: "2400 Ira E Woods Ave, Grapevine, TX 76051", center: [-97.0705, 32.9285], half: [0.0024, 0.0015], vehicles: 18, keys: 3, devices: 1 },
  { name: "Service Center", address: "700 W Northwest Hwy, Grapevine, TX 76051", center: [-97.1105, 32.9205], half: [0.0018, 0.0012], vehicles: 12, keys: 2, devices: 2 },
];

const MODELS: [string, string, number][] = [
  ["BMW", "330i", 34085],
  ["Chevrolet", "Silverado 1500", 48990],
  ["Chevrolet", "Equinox", 29450],
  ["Chevrolet", "Tahoe", 61200],
  ["Chevrolet", "Malibu", 24780],
  ["Chevrolet", "Traverse", 39900],
  ["Chevrolet", "Colorado", 33650],
  ["Ford", "F-150", 41500],
  ["Honda", "Accord", 26300],
  ["Toyota", "RAV4", 30150],
];

const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

export function seedAssets(): Asset[] {
  const rand = mulberry32(7);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");
  const out: Asset[] = [];
  // Vehicles sit in parking rows: ~16 m apart along a row, rows ~30 m apart.
  const M_LAT = 1 / 111_320;
  const mLng = (lat: number) => 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const PER_ROW = 8;
  const inRow = (lot: Lot, i: number): LngLat => {
    const rows = Math.ceil(lot.vehicles / PER_ROW);
    const col = i % PER_ROW;
    const row = Math.floor(i / PER_ROW);
    const dx = (col - (PER_ROW - 1) / 2) * 16 + (rand() - 0.5) * 2;
    const dy = (row - (rows - 1) / 2) * 30 + (rand() - 0.5) * 2;
    return [lot.center[0] + dx * mLng(lot.center[1]), lot.center[1] + dy * M_LAT];
  };
  const at = (lot: Lot, spread = 0.85): LngLat => [
    lot.center[0] + (rand() * 2 - 1) * lot.half[0] * spread,
    lot.center[1] + (rand() * 2 - 1) * lot.half[1] * spread,
  ];

  for (const lot of LOTS) {
    for (let i = 0; i < lot.vehicles; i++) {
      const age: InventoryAge = pick(["new", "new", "new", "mid", "mid", "old"]);
      const [make, model, base] = pick(MODELS);
      const isNew = age === "new" && rand() > 0.3;
      const vin = Array.from({ length: 17 }, () => pick([...VIN_CHARS])).join("");
      out.push({
        id: `v-${out.length}`,
        typeId: `vehicle-${age}`,
        position: inRow(lot, i),
        reporting: rand() > 0.12,
        year: isNew ? 2025 : 2018 + Math.floor(rand() * 7),
        make,
        model,
        vin,
        stock: vin.slice(-7),
        condition: isNew ? "New" : "Preowned",
        price: Math.round((base * (isNew ? 1 : 0.7 + rand() * 0.25)) / 5) * 5,
        miles: isNew ? Math.floor(rand() * 40) : 8000 + Math.floor(rand() * 60000),
        noImage: rand() < 0.12,
      });
    }
    for (let i = 0; i < lot.keys; i++) {
      out.push({ id: `k-${out.length}`, typeId: "key", position: at(lot, 0.6), reporting: true, code: digits(7), address: lot.address });
    }
    for (let i = 0; i < lot.devices; i++) {
      out.push({ id: `d-${out.length}`, typeId: "device", position: at(lot), reporting: rand() > 0.5, code: digits(11), address: lot.address });
    }
  }

  // A few vehicles parked on their own, away from the lots: these never join a cluster.
  const STRAYS: [LngLat, InventoryAge][] = [
    [[-97.0868, 32.9452], "new"],
    [[-97.1046, 32.9331], "old"],
    [[-97.0812, 32.9343], "mid"],
    [[-97.0598, 32.9361], "new"],
  ];
  for (const [position, age] of STRAYS) {
    const [make, model, price] = pick(MODELS);
    const vin = Array.from({ length: 17 }, () => pick([...VIN_CHARS])).join("");
    out.push({
      id: `v-${out.length}`, typeId: `vehicle-${age}`, position, reporting: true,
      year: 2022, make, model, vin, stock: vin.slice(-7), condition: "Preowned", price, miles: 21400,
    });
  }
  return out;
}

export function seedGeofences(): Geofence[] {
  return LOTS.map((lot, i) => {
    const [x, y] = lot.center;
    const [hx, hy] = lot.half;
    return {
      id: `lot-${i}`,
      name: lot.name,
      address: lot.address,
      visible: true,
      points: [
        [x - hx, y + hy],
        [x + hx, y + hy * 1.1],
        [x + hx * 1.05, y - hy],
        [x - hx, y - hy * 0.95],
      ],
    };
  });
}
