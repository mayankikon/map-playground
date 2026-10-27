import type { Asset, AssetType, AssetView, DisplaySettings, LngLat, MapStyleId, Condition } from "./types";

/** Colors and assets come from the "Map Assets" anatomy sheet in Figma (node 15099:114724). */
export const ASSET_TYPES: AssetType[] = [
  { id: "vehicle-new", kind: "vehicle", age: "new", name: "Vehicle · New", description: "Inventory age: new", color: "#00B397" },
  { id: "vehicle-mid", kind: "vehicle", age: "mid", name: "Vehicle · Mid", description: "Inventory age: mid", color: "#E6B117" },
  { id: "vehicle-old", kind: "vehicle", age: "old", name: "Vehicle · Old", description: "Inventory age: old", color: "#E50C0C" },
  { id: "key", kind: "key", name: "Key", description: "Paired key fob", color: "#17A5E6" },
  { id: "device", kind: "device", name: "Installation Exception", description: "GPS device not installed", color: "#666666" },
];

export const TYPE_BY_ID: Record<string, AssetType> = Object.fromEntries(ASSET_TYPES.map((t) => [t.id, t]));

export const FIGMA = {
  carPhoto: "/figma/car-photo.png",
  carPlaceholder: "/figma/car-placeholder.png",
  shield: {
    new: "/figma/shield-new.svg",
    mid: "/figma/shield-mid.svg",
    old: "/figma/shield-old.svg",
    device: "/figma/shield-device.svg",
  },
  shieldHover: {
    new: "/figma/shield-new-hover.svg",
    mid: "/figma/shield-mid-hover.svg",
    old: "/figma/shield-old-hover.svg",
    device: "/figma/shield-device-hover.svg",
  },
  pin: { new: "/figma/pin-new.svg", mid: "/figma/pin-mid.svg", old: "/figma/pin-old.svg" },
  pinHover: { new: "/figma/pin-new-alt.svg", mid: "/figma/pin-mid-alt.svg", old: "/figma/pin-old-alt.svg" },
  gpsDevice: "/figma/gps-device.svg",
  tagNonReporting: "/figma/tag-nonreporting.svg",
  tagDeviceException: "/figma/tag-device-exception.svg",
  keyPaired: "/figma/key-paired.svg",
  battery: "/figma/battery.svg",
  point: "/figma/point.svg",
} as const;

export const MAP_STYLES: { id: MapStyleId; label: string; url: string }[] = [
  { id: "streets", label: "Streets", url: "mapbox://styles/mapbox/streets-v12" },
  { id: "light", label: "Light", url: "mapbox://styles/mapbox/light-v11" },
  { id: "dark", label: "Dark", url: "mapbox://styles/mapbox/dark-v11" },
  { id: "satellite", label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
];

export const styleUrl = (id: MapStyleId) => (MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]).url;

/** Figma "Geofence Boundary" color — every geofence uses it. */
export const GEOFENCE_COLOR = "#0B6494";

/** Text colour per stock type (list rows, cards, key panel). */
export const STOCK_COLOR: Record<Condition, string> = {
  New: "#1a9375",
  Preowned: "#e64b17",
  Loaner: "#6b4fbb",
  Demo: "#0b6494",
  Service: "#a86a00",
  BVA: "#5b6770",
};

export const inView = (a: Asset, view: AssetView) => view === "all" || (TYPE_BY_ID[a.typeId]?.kind === "key") === (view === "keys");

export const DEFAULT_SETTINGS: DisplaySettings = {
  clusterBelowZoom: 18.6,
  groupDistance: 10,
  clusterMinPoints: 5,
  imageFromZoom: 19.2,
  mapStyle: "satellite",
};

/** Fill in missing or invalid display settings (old saves, hot reloads) with safe values. */
export function normalizeSettings(s?: Partial<DisplaySettings>): DisplaySettings {
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, fallback: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  const clusterBelowZoom = num(s?.clusterBelowZoom, d.clusterBelowZoom, 1, 21);
  return {
    clusterBelowZoom,
    imageFromZoom: Math.max(num(s?.imageFromZoom, d.imageFromZoom, 2, 21), clusterBelowZoom),
    groupDistance: num(s?.groupDistance, d.groupDistance, 10, 200),
    clusterMinPoints: Math.round(num(s?.clusterMinPoints, d.clusterMinPoints, 2, 10)),
    mapStyle: MAP_STYLES.some((m) => m.id === s?.mapStyle) ? s!.mapStyle! : d.mapStyle,
  };
}

export const isLngLat = (p: unknown): p is LngLat =>
  Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n)) && Math.abs(p[1]) <= 90;

/** Opens on the Toyota of Grapevine geofence (the map also fits to it on load). */
export const INITIAL_VIEW: { center: LngLat; zoom: number } = {
  center: [-97.06912, 32.92502],
  zoom: 17.4,
};

export function assetTitle(a: Asset): string {
  const kind = TYPE_BY_ID[a.typeId]?.kind;
  if (kind === "vehicle") return [a.year, a.make, a.model].filter(Boolean).join(" ") || "Vehicle";
  if (kind === "key") return `Key ID: ${a.code ?? "—"}`;
  return `Device ID: ${a.code ?? "—"}`;
}

export const fmtMoney = (n?: number) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`);
/** Key / asset position as “lat, long” with 3 decimals. */
export const fmtLatLng = (p: LngLat) => `${p[1].toFixed(3)}, ${p[0].toFixed(3)}`;
export const fmtMiles = (n?: number) => (n == null ? "—" : `${n.toLocaleString("en-US")} miles`);
