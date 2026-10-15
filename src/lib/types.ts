export type LngLat = [number, number];

export type AssetKind = "vehicle" | "key" | "device";
export type InventoryAge = "new" | "mid" | "old";
/** Stock types a vehicle can be listed under. */
export const STOCK_TYPES = ["New", "Preowned", "Loaner", "Demo", "Service", "BVA"] as const;
export type Condition = (typeof STOCK_TYPES)[number];

export interface AssetType {
  id: string;
  kind: AssetKind;
  age?: InventoryAge;
  name: string;
  description: string;
  color: string;
}

export interface Asset {
  id: string;
  /** One of ASSET_TYPES ids — encodes kind + inventory age. */
  typeId: string;
  position: LngLat;
  /** Device is reporting its location. */
  reporting: boolean;

  /* Vehicle */
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  stock?: string;
  condition?: Condition;
  price?: number;
  miles?: number;
  /** Custom photo (data URL). */
  image?: string;
  /** Show the "No Image" placeholder instead of a photo. */
  noImage?: boolean;
  /** Pinned with "Mark as Featured" on the details page. */
  featured?: boolean;
  /** Free-text remark added from the details page. */
  remark?: string;

  /* Key / device */
  code?: string;
  address?: string;
  /** Key: the key cabinet / office it is stored in (see KEY_HUBS). */
  hubId?: string;
  /** Key: the vehicle this key belongs to. */
  vehicleId?: string;
}

export interface Geofence {
  id: string;
  name: string;
  address: string;
  points: LngLat[];
  visible: boolean;
}

export type MapStyleId = "streets" | "light" | "dark" | "satellite";

export interface DisplaySettings {
  /** Dense groups stay clustered while zoom < this value. */
  clusterBelowZoom: number;
  /** Assets within this many meters of each other form a group. */
  groupDistance: number;
  /** Fewest assets that make a group a cluster; smaller groups show individually. */
  clusterMinPoints: number;
  /** Image-style markers are shown while zoom >= this value. */
  imageFromZoom: number;
  mapStyle: MapStyleId;
}

/** Which asset family the map shows. Installation exceptions belong to vehicles. */
export type AssetView = "vehicles" | "keys" | "all";


export type Mode =
  | { kind: "idle" }
  | { kind: "place"; typeId: string }
  | { kind: "draw" };

export type FlyRequest =
  | { kind: "point"; center: LngLat; zoom?: number; /** px shift of the target from the map center */ offset?: [number, number] }
  | { kind: "bounds"; points: LngLat[]; padding?: { top: number; bottom: number; left: number; right: number }; maxZoom?: number };

export type FlyTarget = FlyRequest & { nonce: number };

export type ZoomTier = "clusters" | "markers" | "images";

export function zoomTier(zoom: number, s: DisplaySettings): ZoomTier {
  if (zoom >= s.imageFromZoom) return "images";
  if (zoom < s.clusterBelowZoom) return "clusters";
  return "markers";
}

/** Prototype version: V2 is the current design; V1 is the earlier, gateway-only key panel. */
export type AppVersion = "v1" | "v2";
