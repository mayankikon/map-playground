import { TYPE_BY_ID } from "./catalog";
import { KEY_HUBS } from "./hubs";
import type { Asset } from "./types";

/**
 * Details the vehicle details page shows that the demo data doesn't store yet.
 * Everything is derived deterministically from the vehicle so it stays stable
 * between reloads; swap these for real fields when the API provides them.
 */

interface Spec {
  type: string;
  drivetrain: string;
  transmission: string;
  engine: string;
  cylinders: string;
  mpg: string;
  fuel: string;
  doors: number;
  seats: number;
}

const SPECS: Record<string, Spec> = {
  Camry: { type: "Sedan", drivetrain: "FWD", transmission: "Automatic", engine: "I4, 2.5 Liter", cylinders: "4-Cyl", mpg: "28/39 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  RAV4: { type: "SUV", drivetrain: "AWD", transmission: "Automatic", engine: "I4, 2.5 Liter", cylinders: "4-Cyl", mpg: "27/35 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  Tacoma: { type: "Truck", drivetrain: "4WD", transmission: "Automatic", engine: "I4, 2.4 Liter", cylinders: "4-Cyl Turbo", mpg: "20/24 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  Tundra: { type: "Truck", drivetrain: "4WD", transmission: "Automatic", engine: "V6, 3.4 Liter", cylinders: "6-Cyl Twin Turbo", mpg: "18/24 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  Highlander: { type: "SUV", drivetrain: "AWD", transmission: "Automatic", engine: "I4, 2.4 Liter", cylinders: "4-Cyl Turbo", mpg: "21/28 mpg", fuel: "Gasoline", doors: 4, seats: 8 },
  "Grand Highlander": { type: "SUV", drivetrain: "AWD", transmission: "Automatic", engine: "I4, 2.4 Liter", cylinders: "4-Cyl Turbo", mpg: "21/28 mpg", fuel: "Gasoline", doors: 4, seats: 7 },
  Corolla: { type: "Sedan", drivetrain: "FWD", transmission: "CVT", engine: "I4, 2.0 Liter", cylinders: "4-Cyl", mpg: "32/41 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  "4Runner": { type: "SUV", drivetrain: "4WD", transmission: "Automatic", engine: "I4, 2.4 Liter", cylinders: "4-Cyl Turbo", mpg: "20/24 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  Sienna: { type: "Minivan", drivetrain: "FWD", transmission: "CVT", engine: "I4, 2.5 Liter Hybrid", cylinders: "4-Cyl", mpg: "36/36 mpg", fuel: "Hybrid", doors: 4, seats: 8 },
  Prius: { type: "Sedan", drivetrain: "FWD", transmission: "CVT", engine: "I4, 2.0 Liter Hybrid", cylinders: "4-Cyl", mpg: "57/56 mpg", fuel: "Hybrid", doors: 4, seats: 5 },
  "330i": { type: "Sedan", drivetrain: "RWD", transmission: "Automatic", engine: "I4, 2.0 Liter", cylinders: "4-Cyl Turbo", mpg: "26/36 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  "Silverado 1500": { type: "Truck", drivetrain: "4WD", transmission: "Automatic", engine: "V8, 5.3 Liter", cylinders: "8-Cyl", mpg: "16/20 mpg", fuel: "Gasoline", doors: 4, seats: 6 },
  Equinox: { type: "SUV", drivetrain: "AWD", transmission: "Automatic", engine: "I4, 1.5 Liter", cylinders: "4-Cyl Turbo", mpg: "25/30 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  Tahoe: { type: "SUV", drivetrain: "4WD", transmission: "Automatic", engine: "V8, 5.3 Liter", cylinders: "8-Cyl", mpg: "15/20 mpg", fuel: "Gasoline", doors: 4, seats: 8 },
  Malibu: { type: "Sedan", drivetrain: "FWD", transmission: "CVT", engine: "I4, 1.5 Liter", cylinders: "4-Cyl Turbo", mpg: "28/36 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  Traverse: { type: "SUV", drivetrain: "AWD", transmission: "Automatic", engine: "I4, 2.5 Liter", cylinders: "4-Cyl Turbo", mpg: "20/27 mpg", fuel: "Gasoline", doors: 4, seats: 8 },
  Colorado: { type: "Truck", drivetrain: "4WD", transmission: "Automatic", engine: "I4, 2.7 Liter", cylinders: "4-Cyl Turbo", mpg: "18/23 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
  "F-150": { type: "Truck", drivetrain: "4WD", transmission: "Automatic", engine: "V6, 3.5 Liter", cylinders: "6-Cyl Twin Turbo", mpg: "18/24 mpg", fuel: "Gasoline", doors: 4, seats: 6 },
  Accord: { type: "Sedan", drivetrain: "FWD", transmission: "CVT", engine: "I4, 1.5 Liter", cylinders: "4-Cyl Turbo", mpg: "29/37 mpg", fuel: "Gasoline", doors: 4, seats: 5 },
};

const DEFAULT_SPEC: Spec = { type: "Sedan", drivetrain: "FWD", transmission: "Automatic", engine: "I4, 2.0 Liter", cylinders: "4-Cyl", mpg: "27/34 mpg", fuel: "Gasoline", doors: 4, seats: 5 };

const EXTERIOR = ["Super White", "Midnight Black", "Celestial Silver", "Magnetic Gray", "Supersonic Red", "Blueprint", "Wind Chill Pearl", "Underground"];
const INTERIOR = ["Black", "Beige", "Light Gray", "Boulder", "Cockpit Red"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export interface VehicleInfo {
  spec: Spec;
  exterior: string;
  interior: string;
  deviceId: string;
  inventoryDays: number;
  batteryVolts: number;
  batteryLow: boolean;
  safety: { overall: number; front: number; side: number; rollover: number };
  /** Minutes since the GPS device last reported. */
  reportedMinutesAgo: number;
}

export function vehicleInfo(v: Asset, batteryLow: boolean): VehicleInfo {
  const h = hash(v.id + (v.vin ?? ""));
  const age = TYPE_BY_ID[v.typeId]?.age ?? "new";
  const [lo, span] = age === "new" ? [3, 42] : age === "mid" ? [46, 44] : [91, 120];
  return {
    spec: SPECS[v.model ?? ""] ?? DEFAULT_SPEC,
    exterior: EXTERIOR[h % EXTERIOR.length],
    interior: INTERIOR[(h >>> 3) % INTERIOR.length],
    deviceId: String(359355510000000 + (h % 999_999_999)),
    inventoryDays: lo + (h % span),
    batteryVolts: batteryLow ? 11.4 + ((h >>> 5) % 6) / 10 : 12.6 + ((h >>> 5) % 22) / 10,
    batteryLow,
    safety: { overall: 4 + ((h >>> 2) % 2), front: 4 + ((h >>> 4) % 2), side: 4 + ((h >>> 6) % 2), rollover: 3 + ((h >>> 8) % 2) },
    reportedMinutesAgo: v.reporting ? 0 : 60 + (h % 600),
  };
}

export function ago(minutes: number) {
  if (minutes <= 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const h = Math.round(minutes / 60);
  return `Updated ${h} hour${h === 1 ? "" : "s"} ago`;
}

/** Gallery for a vehicle: its own photo first, then the Figma sample photos. */
export function vehiclePhotos(v: Asset): string[] {
  const sample = Array.from({ length: 10 }, (_, i) => `/figma/detail/photo-${i + 1}.jpg`);
  return v.image ? [v.image, ...sample.slice(1)] : sample;
}

export interface KeyInfo {
  /** Key tag battery, 0-100 %. */
  batteryPct: number;
  batteryLow: boolean;
  /** Minutes since the key tag last reported. */
  reportedMinutesAgo: number;
}

/** Battery and last report for a key tag; keys in an offline room stopped reporting hours ago. */
export function keyInfo(k: Asset): KeyInfo {
  const h = hash(k.id + (k.code ?? ""));
  // Most tags are healthy; roughly 1 in 8 is running low.
  const batteryPct = h % 8 === 0 ? 5 + ((h >>> 3) % 15) : 35 + ((h >>> 3) % 66);
  const online = KEY_HUBS.find((hub) => hub.id === k.hubId)?.online ?? k.reporting;
  const reportedMinutesAgo = online ? (h >>> 7) % 45 : 120 + ((h >>> 7) % 900);
  return { batteryPct, batteryLow: batteryPct < 20, reportedMinutesAgo };
}
