import { mulberry32, pointInPolygon } from "./geo";
import { TOYOTA_GRAPEVINE } from "./toyota-lot";
import type { Asset, Geofence, LngLat } from "./types";

/** A place where keys are stored and reported from (key cabinet, office, …). */
export interface KeyHub {
  id: string;
  name: string;
  position: LngLat;
  online: boolean;
  icon: "cabinet" | "showroom" | "parts" | "tower" | "office";
  /** Photo of the room, from /public/rooms. */
  image?: string;
}

/** Key locations inside the Toyota of Grapevine building. */
export const KEY_HUBS: KeyHub[] = [
  { id: "hub-key-room", name: "Key Room", position: [-97.06905, 32.9247], online: true, icon: "cabinet", image: "/rooms/key-room.jpg" },
  { id: "hub-showroom", name: "Showroom", position: [-97.0693, 32.9249], online: true, icon: "showroom", image: "/rooms/showroom.jpg" },
  { id: "hub-parts", name: "Parts Department", position: [-97.0688, 32.925], online: true, icon: "parts", image: "/rooms/parts.jpg" },
  { id: "hub-sales-tower", name: "Sales Tower", position: [-97.06948, 32.92455], online: false, icon: "tower", image: "/rooms/sales-tower.jpg" },
  { id: "hub-gm-office", name: "GM's Office", position: [-97.0693, 32.92471], online: true, icon: "office", image: "/rooms/gm-office.jpg" },
];

/** Keys that are not in a hub are grouped by where they are. */
export type KeyGroupId = "lot" | "off";
export const KEY_GROUPS: { id: KeyGroupId; name: string }[] = [
  { id: "lot", name: "On the Lot" },
  { id: "off", name: "Off-Lot" },
];

export type KeyLocationId = string; // hub id or `group:lot` / `group:off`

const isKey = (a: Asset) => a.typeId === "key";

/** Which hub or group a key belongs to. */
export function keyLocation(key: Asset, geofences: Geofence[]): KeyLocationId {
  if (key.hubId && KEY_HUBS.some((h) => h.id === key.hubId)) return key.hubId;
  const onLot = geofences.some((g) => g.points.length >= 3 && pointInPolygon(key.position, g.points));
  return onLot ? "group:lot" : "group:off";
}

export function keysByLocation(assets: Asset[], geofences: Geofence[]) {
  const out = new Map<KeyLocationId, Asset[]>();
  for (const a of assets) {
    if (!isKey(a)) continue;
    const loc = keyLocation(a, geofences);
    const list = out.get(loc);
    if (list) list.push(a);
    else out.set(loc, [a]);
  }
  return out;
}

/** Share of keys stored in each room (the rest of a pair can sit in a different room). */
const ROOM_WEIGHTS: [string, number][] = [
  ["hub-key-room", 0.6],
  ["hub-showroom", 0.15],
  ["hub-parts", 0.08],
  ["hub-sales-tower", 0.08],
  ["hub-gm-office", 0.09],
];

/**
 * One or two keys for every Toyota of Grapevine vehicle, all stored inside the building.
 * Each key gets its own spot a few meters around its room so a pair can be told apart.
 */
export function seedHubKeys(toyotaVehicles: Asset[]): Asset[] {
  const rand = mulberry32(2026);
  const vehicles = toyotaVehicles.filter((v) => v.typeId.startsWith("vehicle"));
  const out: Asset[] = [];
  const perRoom: Record<string, number> = {};
  let code = 107919;
  const nextCode = () => String((code += 37 + Math.floor(rand() * 900)));
  const kx = 111_320 * Math.cos((32.925 * Math.PI) / 180);
  const ky = 110_574;
  const pickRoom = () => {
    let r = rand();
    for (const [id, w] of ROOM_WEIGHTS) if ((r -= w) <= 0) return KEY_HUBS.find((h) => h.id === id)!;
    return KEY_HUBS[0];
  };

  for (const v of vehicles) {
    // About a third of the vehicles came in with a single key.
    const count = rand() < 0.35 ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const hub = pickRoom();
      const n = (perRoom[hub.id] = (perRoom[hub.id] ?? 0) + 1);
      const ang = rand() * Math.PI * 2;
      const dist = 1 + rand() * 3; // meters from the room's center, still inside the building
      out.push({
        id: `tgv-hk-${hub.id}-${n}`,
        typeId: "key",
        position: [hub.position[0] + (Math.cos(ang) * dist) / kx, hub.position[1] + (Math.sin(ang) * dist) / ky],
        reporting: true,
        code: nextCode(),
        address: TOYOTA_GRAPEVINE.address,
        hubId: hub.id,
        vehicleId: v.id,
      });
    }
  }
  return out;
}
