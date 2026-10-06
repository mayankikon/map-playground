export type LngLat = [number, number];

export type AssetKind = "vehicle" | "key" | "device";
export type InventoryAge = "new" | "mid" | "old";
export type Condition = "New" | "Preowned";

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

  /* Key / device */
  code?: string;
  address?: string;
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
export type AssetView = "vehicles" | "keys";

export type Mode =
  | { kind: "idle" }
  | { kind: "place"; typeId: string }
  | { kind: "draw" };

export type FlyRequest =
  | { kind: "point"; center: LngLat; zoom?: number }
  | { kind: "bounds"; points: LngLat[] };

export type FlyTarget = FlyRequest & { nonce: number };

export type ZoomTier = "clusters" | "markers" | "images";

export function zoomTier(zoom: number, s: DisplaySettings): ZoomTier {
  if (zoom >= s.imageFromZoom) return "images";
  if (zoom < s.clusterBelowZoom) return "clusters";
  return "markers";
}
