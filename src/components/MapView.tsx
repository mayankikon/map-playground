"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type mapboxgl from "mapbox-gl";
import type { GeoJSONSource, LngLatBounds, Map as MbMap, MapMouseEvent, Marker } from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";

import { FIGMA, GEOFENCE_COLOR, INITIAL_VIEW, TYPE_BY_ID, normalizeSettings, styleUrl } from "@/lib/catalog";
import { centroid, closeRing } from "@/lib/geo";
import type { Asset, DisplaySettings, FlyTarget, Geofence, LngLat, Mode, ZoomTier } from "@/lib/types";
import { AssetMarker, AssetPreview } from "./markers";
import { FocusOverlay } from "./focus";

export const ASSET_DRAG_MIME = "application/x-asset-type";

interface Props {
  assets: Asset[];
  geofences: Geofence[];
  settings: DisplaySettings;
  mode: Mode;
  draft: LngLat[];
  selectedAssetId: string | null;
  selectedGeofenceId: string | null;
  flyTarget: FlyTarget | null;
  onPlaceAsset: (typeId: string, pos: LngLat) => void;
  onMoveAsset: (id: string, pos: LngLat) => void;
  onSelectAsset: (id: string | null) => void;
  onSelectGeofence: (id: string | null) => void;
  onDraftAdd: (pos: LngLat) => void;
  onDraftFinish: () => void;
  onZoom: (zoom: number) => void;
  /** Hands the map instance to the app shell for its own zoom / compass controls. */
  onReady?: (map: MbMap) => void;
  /** Selected vehicle: always drawn as its image card, with its paired keys; everything else dims. */
  focusVehicle?: Asset | null;
  focusKeys?: Asset[];
  /** Key the focused vehicle was opened from: the only highlighted key tag. */
  focusKeyId?: string | null;
  onPickFocusKey?: (keyId: string) => void;
  /** Dim every regular marker to 50% (e.g. while a key room is open). */
  dim?: boolean;
  /** V0 Keys view: hovering a key marker dims every other marker, the hovered key stays full. */
  dimOnKeyHover?: boolean;
}

/** 50% opacity on every regular marker layer; hover and click still work. */
/** Dimmed (everything but the focus): 42% opacity and 10% less saturation. */
export const DIM_OPACITY = 0.42;
const DIM_SATURATION = 0.9;
const dimmedMaps = new WeakSet<MbMap>();

/** Dim every pin and cluster except one asset (the hovered key), which keeps its hover icon. */
function applyDimExcept(map: MbMap, id: string) {
  if (!map.getLayer("asset-pins")) return;
  const isIt: mapboxgl.ExpressionSpecification = ["==", ["get", "id"], id];
  map.setLayoutProperty("asset-pins", "icon-image", ["case", isIt, ["get", "iconHover"], pinIconExpr(null, true)]);
  map.setPaintProperty("asset-pins", "icon-opacity", ["case", isIt, 1, DIM_OPACITY]);
  map.setPaintProperty("clusters", "circle-opacity", DIM_OPACITY);
  map.setPaintProperty("clusters", "circle-stroke-opacity", DIM_OPACITY);
  map.setPaintProperty("cluster-count", "text-opacity", DIM_OPACITY);
  map.setPaintProperty("cluster-shadow", "circle-opacity", 0.22 * DIM_OPACITY);
}

function applyDim(map: MbMap, dim: boolean) {
  if (!map.getLayer("asset-pins")) return;
  if (dim) dimmedMaps.add(map);
  else dimmedMaps.delete(map);
  const o = dim ? DIM_OPACITY : 1;
  // Symbol icons have no saturation paint property: switch to the pre-desaturated "-dim" copies.
  map.setLayoutProperty("asset-pins", "icon-image", pinIconExpr(null, dim));
  map.setPaintProperty("asset-pins", "icon-opacity", o);
  map.setPaintProperty("clusters", "circle-opacity", o);
  map.setPaintProperty("clusters", "circle-stroke-opacity", o);
  map.setPaintProperty("cluster-count", "text-opacity", o);
  map.setPaintProperty("cluster-shadow", "circle-opacity", dim ? 0.22 * DIM_OPACITY : 0.22);
}

type Hover = { kind: "asset"; id: string } | null;

const FONT = ["DIN Pro Medium", "Arial Unicode MS Bold"];
const LAYERS = [
  "geofence-fill", "geofence-line", "geofence-label",
  "draft-fill", "draft-line", "draft-vertex",
  "cluster-ring", "cluster-shadow", "clusters", "cluster-count",
  "asset-pins",
];
const SOURCES = ["geofences", "draft", "assets", "asset-clusters"];
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const BRAND = GEOFENCE_COLOR;

/* ---------- Marker geometry (px), derived from the Figma anatomy ---------- */

/** How each mid-zoom icon sits on its coordinate, and how far above it the top edge is. */
function pinIcon(a: Asset) {
  const t = TYPE_BY_ID[a.typeId];
  if (t?.kind === "key") return { icon: "pin-key", anchor: "center", offset: [0, 0], top: 24 };
  if (t?.kind === "device") return { icon: "pin-device", anchor: "bottom", offset: [0, 6], top: 46 };
  return { icon: `pin-${t?.age ?? "new"}`, anchor: "bottom", offset: [0, 10.5], top: 34 };
}

function previewOffset(a: Asset, tier: ZoomTier) {
  const kind = TYPE_BY_ID[a.typeId]?.kind;
  if (tier !== "images") return pinIcon(a).top + 4;
  return kind === "key" ? 26 : 50;
}

/* ---------- GeoJSON builders ---------- */

/** Every asset as a point feature (pins and the cluster source share this data). */
function assetsFC(assets: Asset[], selectedId: string | null, drag: { id: string; pos: LngLat } | null): FeatureCollection {
  const placed = drag ? assets.map((a) => (a.id === drag.id ? { ...a, position: drag.pos } : a)) : assets;
  return {
    type: "FeatureCollection",
    features: placed.map((a): Feature => {
      const p = pinIcon(a);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: a.position },
        properties: { id: a.id, weight: 1, icon: p.icon, iconHover: `${p.icon}-hover`, anchor: p.anchor, offset: p.offset, selected: a.id === selectedId },
      };
    }),
  };
}

function geofencesFC(geofences: Geofence[], selectedId: string | null): FeatureCollection {
  const features: Feature[] = [];
  for (const g of geofences) {
    if (!g.visible || g.points.length < 3) continue;
    const props = { id: g.id, name: g.name, selected: g.id === selectedId };
    features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [closeRing(g.points)] }, properties: { ...props, kind: "area" } });
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: centroid(g.points) }, properties: { ...props, kind: "label" } });
  }
  return { type: "FeatureCollection", features };
}

function draftFC(draft: LngLat[], cursor: LngLat | null): FeatureCollection {
  const features: Feature[] = [];
  const path = cursor ? [...draft, cursor] : draft;
  if (path.length >= 3) features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [closeRing(path)] }, properties: { kind: "area" } });
  if (path.length >= 2) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: path }, properties: { kind: "line" } });
  draft.forEach((p, i) =>
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: { kind: "vertex", first: i === 0 && draft.length >= 3 } }),
  );
  return { type: "FeatureCollection", features };
}

/* ---------- Rasterize the Figma marker assets for the symbol layer ---------- */

const RATIO = 2;
let iconCache: Promise<Record<string, ImageData>> | null = null;

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w * RATIO;
  c.height = h * RATIO;
  const ctx = c.getContext("2d")!;
  ctx.scale(RATIO, RATIO);
  return { ctx, data: () => ctx.getImageData(0, 0, c.width, c.height) };
}

function buildIcons(): Promise<Record<string, ImageData>> {
  iconCache ??= (async () => {
    const srcs = [
      FIGMA.pin.new, FIGMA.pin.mid, FIGMA.pin.old, FIGMA.pinHover.new, FIGMA.pinHover.mid, FIGMA.pinHover.old,
      FIGMA.keyPaired, FIGMA.shield.device, FIGMA.shieldHover.device, FIGMA.gpsDevice, FIGMA.tagDeviceException,
    ];
    const imgs = Object.fromEntries(await Promise.all(srcs.map(async (s) => [s, await loadImg(s)] as const)));
    const out: Record<string, ImageData> = {};

    // Vehicle "Marker" pins (two Figma columns: default + highlighted)
    for (const age of ["new", "mid", "old"] as const) {
      for (const hover of [false, true]) {
        const { ctx, data } = canvas(48, 50);
        ctx.drawImage(imgs[hover ? FIGMA.pinHover[age] : FIGMA.pin[age]], 0, 0, 48, 49.283);
        out[`pin-${age}${hover ? "-hover" : ""}`] = data();
      }
    }

    // Key marker: 32px tile inside a 48px box, halo on hover
    for (const hover of [false, true]) {
      const { ctx, data } = canvas(52, 52);
      if (hover) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#336c8b";
        ctx.beginPath();
        ctx.roundRect(0, 0, 52, 52, 14);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowOffsetY = 4;
      ctx.shadowBlur = 4;
      ctx.fillStyle = "#17a5e6";
      ctx.beginPath();
      ctx.roundRect(10, 10, 32, 32, 4);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#336c8b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(11, 11, 30, 30, 3);
      ctx.stroke();
      ctx.drawImage(imgs[FIGMA.keyPaired], 14, 14, 24, 24);
      out[`pin-key${hover ? "-hover" : ""}`] = data();
    }

    // Installation exception: neutral shield + GPS glyph + exception tag
    for (const hover of [false, true]) {
      const { ctx, data } = canvas(78, 56);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowOffsetY = 4;
      ctx.shadowBlur = 2;
      ctx.drawImage(imgs[hover ? FIGMA.shieldHover.device : FIGMA.shield.device], 6, 9, 62, 41.8);
      ctx.restore();
      ctx.drawImage(imgs[FIGMA.gpsDevice], 29, 16, 16, 24);
      ctx.drawImage(imgs[FIGMA.tagDeviceException], 57, 0, 20, 20);
      out[`pin-device${hover ? "-hover" : ""}`] = data();
    }
    return out;
  })();
  return iconCache;
}

async function installImages(map: MbMap) {
  const icons = await buildIcons();
  for (const [name, img] of Object.entries(icons)) {
    if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: RATIO });
    if (!map.hasImage(`${name}-dim`)) map.addImage(`${name}-dim`, desaturate(img, DIM_SATURATION), { pixelRatio: RATIO });
  }
}

/* ---------- Layers ---------- */

/** Copy of an icon with its saturation scaled (Rec. 709 luma kept). */
function desaturate(img: ImageData, amount: number): ImageData {
  const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = l + (d[i] - l) * amount;
    d[i + 1] = l + (d[i + 1] - l) * amount;
    d[i + 2] = l + (d[i + 2] - l) * amount;
  }
  return out;
}

function pinIconExpr(hoverId: string | null, dim = false): mapboxgl.ExpressionSpecification {
  const icon: mapboxgl.ExpressionSpecification = ["case", ["any", ["get", "selected"], ["==", ["get", "id"], hoverId ?? ""]], ["get", "iconHover"], ["get", "icon"]];
  return dim ? ["concat", icon, "-dim"] : icon;
}

/** Hovered bubble: a cluster (by cluster id) or a lone asset drawn as a “1” bubble (by asset id). */
type BubbleKey = { clusterId?: number | string; assetId?: string } | null;

function bubbleHoverExpr(key: BubbleKey): mapboxgl.ExpressionSpecification {
  return ["any", ["==", ["id"], key?.clusterId ?? -1], ["==", ["get", "id"], key?.assetId ?? ""]];
}

function applyBubbleHover(map: MbMap, key: BubbleKey) {
  if (!map.getLayer("clusters")) return;
  const h = bubbleHoverExpr(key);
  map.setPaintProperty("cluster-ring", "circle-opacity", ["case", h, 0.4, 0]);
  map.setPaintProperty("clusters", "circle-color", ["case", h, "#F1FFFA", "#FFFFFF"]);
  map.setPaintProperty("clusters", "circle-stroke-color", ["case", h, "#99A3AD", "#DCDCDC"]);
}

function installLayers(map: MbMap, s: DisplaySettings) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id);

  map.addSource("geofences", { type: "geojson", data: EMPTY });
  map.addSource("draft", { type: "geojson", data: EMPTY });
  // Two sources with the same data, one per zoom tier, so the switch happens exactly at
  // clusterBelowZoom (supercluster itself only switches on whole zooms):
  // - "asset-clusters": everything clustered (50 px), drawn only below clusterBelowZoom;
  //   a lone asset there is drawn as a “1” bubble, never as a pin.
  // - "assets": plain points, drawn as pins from clusterBelowZoom (image cards from imageFromZoom).
  map.addSource("asset-clusters", {
    type: "geojson",
    data: EMPTY,
    cluster: true,
    maxzoom: 22,
    clusterMaxZoom: 22,
    clusterRadius: 50,
    clusterProperties: { weight: ["+", ["get", "weight"]] },
  });
  map.addSource("assets", { type: "geojson", data: EMPTY, maxzoom: 22 });


  const area = ["==", ["get", "kind"], "area"] as mapboxgl.FilterSpecification;
  // Figma "Geofence Boundary": rgba(11,100,148,.3) fill with a 2px white stroke
  map.addLayer({
    id: "geofence-fill", type: "fill", source: "geofences", filter: area,
    paint: { "fill-color": GEOFENCE_COLOR, "fill-opacity": ["case", ["get", "selected"], 0.42, 0.3] },
  });
  map.addLayer({
    id: "geofence-line", type: "line", source: "geofences", filter: area,
    paint: { "line-color": "#ffffff", "line-width": ["case", ["get", "selected"], 3.5, 2] },
  });
  map.addLayer({
    id: "geofence-label", type: "symbol", source: "geofences", filter: ["==", ["get", "kind"], "label"],
    layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": 0.1 },
    paint: { "text-color": GEOFENCE_COLOR, "text-halo-color": "#fff", "text-halo-width": 2, "text-opacity": 0.85 },
  });

  map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: area, paint: { "fill-color": BRAND, "fill-opacity": 0.18 } });
  map.addLayer({
    id: "draft-line", type: "line", source: "draft", filter: ["==", ["get", "kind"], "line"],
    paint: { "line-color": BRAND, "line-width": 2, "line-dasharray": [2, 1.5] },
  });
  map.addLayer({
    id: "draft-vertex", type: "circle", source: "draft", filter: ["==", ["get", "kind"], "vertex"],
    paint: {
      "circle-radius": ["case", ["get", "first"], 8, 5],
      "circle-color": ["case", ["get", "first"], BRAND, "#ffffff"],
      "circle-stroke-color": ["case", ["get", "first"], "#ffffff", BRAND],
      "circle-stroke-width": 2.5,
    },
  });

  // Figma "Vehicle Cluster": white 32px disc, #DCDCDC stroke, #126550 count; hover adds a #48A991 ring
  const hovered = bubbleHoverExpr(null);
  const r = ["step", ["get", "weight"], 15, 100, 18, 1000, 22] as mapboxgl.ExpressionSpecification;
  map.addLayer({
    id: "cluster-ring", type: "circle", source: "asset-clusters", maxzoom: s.clusterBelowZoom,
    paint: { "circle-radius": ["+", r, 10], "circle-color": "#48A991", "circle-opacity": ["case", hovered, 0.4, 0] },
  });
  map.addLayer({
    id: "cluster-shadow", type: "circle", source: "asset-clusters", maxzoom: s.clusterBelowZoom,
    paint: { "circle-radius": ["+", r, 2], "circle-color": "#000", "circle-opacity": 0.22, "circle-blur": 0.5, "circle-translate": [0, 4] },
  });
  map.addLayer({
    id: "clusters", type: "circle", source: "asset-clusters", maxzoom: s.clusterBelowZoom,
    paint: {
      "circle-radius": r,
      "circle-color": ["case", hovered, "#F1FFFA", "#FFFFFF"],
      "circle-stroke-color": ["case", hovered, "#99A3AD", "#DCDCDC"],
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "cluster-count", type: "symbol", source: "asset-clusters", maxzoom: s.clusterBelowZoom,
    layout: { "text-field": ["to-string", ["get", "weight"]], "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-size": 15, "text-allow-overlap": true },
    paint: { "text-color": "#126550" },
  });

  map.addLayer({
    id: "asset-pins", type: "symbol", source: "assets", minzoom: s.clusterBelowZoom, maxzoom: s.imageFromZoom,
    layout: {
      "icon-image": pinIconExpr(null),
      "icon-anchor": ["get", "anchor"],
      "icon-offset": ["get", "offset"],
      "icon-allow-overlap": true,
      "symbol-sort-key": ["case", ["get", "selected"], 1, 0],
    },
  });
}

/**
 * queryRenderedFeatures can throw "feature index out of bounds" when a pointer event
 * lands while a GeoJSON source is mid-update; treat that frame as "nothing here".
 */
function safeQuery(m: MbMap, point: mapboxgl.PointLike, layers: string[]) {
  try {
    return m.queryRenderedFeatures(point, { layers: layers.filter((l) => m.getLayer(l)) });
  } catch {
    return [];
  }
}

/* ---------- Popover that tracks a map coordinate ---------- */

function MapPopover({ map, at, offset, children }: { map: MbMap; at: LngLat; offset: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lng, lat] = at;
  useLayoutEffect(() => {
    const place = () => {
      const p = map.project([lng, lat]);
      // Whole-pixel anchor keeps the card and its pointer crisp (no hairline seam).
      if (ref.current) ref.current.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - offset)}px)`;
    };
    place();
    map.on("move", place);
    return () => {
      map.off("move", place);
    };
  }, [map, lng, lat, offset]);
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-20 h-0 w-0">
      <div className="absolute bottom-0 left-0 w-max -translate-x-1/2">
        <div className="animate-[pop-in_120ms_ease-out]">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */

export default function MapView(props: Props) {
  const { assets, geofences, settings, mode, draft, selectedAssetId, selectedGeofenceId, flyTarget } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MbMap | null>(null);
  const mbRef = useRef<typeof mapboxgl | null>(null);
  const latest = useRef(props);
  const cursorRef = useRef<LngLat | null>(null);
  const dragRef = useRef<{ id: string; pos: LngLat } | null>(null);
  const justDraggedRef = useRef(0);
  const hoverRef = useRef<Hover>(null);
  const bubbleHoverRef = useRef<BubbleKey>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());

  const [map, setMap] = useState<MbMap | null>(null);
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom);
  const [bounds, setBounds] = useState<LngLatBounds | null>(null);
  const [portals, setPortals] = useState<[string, HTMLDivElement][]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [hover, setHoverState] = useState<Hover>(null);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const setHover = (h: Hover) => {
    const prev = hoverRef.current;
    const same =
      prev === h ||
      (prev && h && prev.id === h.id);
    if (same) return;
    hoverRef.current = h;
    setHoverState(h);
    const m = mapRef.current;
    if (m?.getLayer("asset-pins")) m.setLayoutProperty("asset-pins", "icon-image", pinIconExpr(h?.kind === "asset" ? h.id : null, dimmedMaps.has(m)));
  };

  const setBubbleHover = (m: MbMap, key: BubbleKey) => {
    const prev = bubbleHoverRef.current;
    if (prev?.clusterId === key?.clusterId && prev?.assetId === key?.assetId) return;
    bubbleHoverRef.current = key;
    applyBubbleHover(m, key);
  };

  const pushAssets = (m: MbMap) => {
    const P = latest.current;
    // The focused vehicle and its keys are drawn by the focus overlay instead.
    const hidden = new Set([P.focusVehicle?.id, ...(P.focusKeys ?? []).map((k) => k.id)]);
    const shown = hidden.size > 1 || P.focusVehicle ? P.assets.filter((a) => !hidden.has(a.id)) : P.assets;
    const fc = assetsFC(shown, P.selectedAssetId, dragRef.current);
    (m.getSource("assets") as GeoJSONSource | undefined)?.setData(fc);
    (m.getSource("asset-clusters") as GeoJSONSource | undefined)?.setData(fc);
  };

  const pushGeofences = (m: MbMap) => {
    const P = latest.current;
    (m.getSource("geofences") as GeoJSONSource | undefined)?.setData(geofencesFC(P.geofences, P.selectedGeofenceId));
  };
  const pushDraft = (m: MbMap) => {
    const P = latest.current;
    const cursor = P.mode.kind === "draw" ? cursorRef.current : null;
    (m.getSource("draft") as GeoJSONSource | undefined)?.setData(draftFC(P.mode.kind === "draw" ? P.draft : [], cursor));
  };
  const reinstall = (m: MbMap) => {
    bubbleHoverRef.current = null;
    installLayers(m, normalizeSettings(latest.current.settings));
    m.setLayoutProperty("asset-pins", "icon-image", pinIconExpr(hoverRef.current?.kind === "asset" ? hoverRef.current.id : null, dimmedMaps.has(m)));
    void installImages(m);
    pushAssets(m);
    pushGeofences(m);
    pushDraft(m);
    applyDim(m, !!latest.current.focusVehicle || !!latest.current.dim);
  };

  /* Init map once */
  useEffect(() => {
    let cancelled = false;
    let created: MbMap | undefined;
    let resizeObserver: ResizeObserver | undefined;
    const markers = markersRef.current;

    (async () => {
      const mb = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mb.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
      mbRef.current = mb;

      const m = new mb.Map({
        container: containerRef.current,
        style: styleUrl(latest.current.settings.mapStyle),
        center: INITIAL_VIEW.center,
        zoom: INITIAL_VIEW.zoom,
        projection: "mercator",
      });
      created = m;
      mapRef.current = m;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __map: MbMap }).__map = m;

      // Keep the canvas filling its container. Mapbox only listens to window resizes, so
      // collapsing the list panel (or any layout change beside the map) left a blank strip.
      // (ResizeObserver already batches to once per frame.)
      resizeObserver = new ResizeObserver(() => m.resize());
      resizeObserver.observe(containerRef.current);

      m.on("style.load", () => reinstall(m));
      m.on("load", () => {
        setMap(m);
        latest.current.onReady?.(m);
        setBounds(m.getBounds());
        pushAssets(m);
      });
      m.on("zoom", () => {
        const z = m.getZoom();
        setZoom(z);
        latest.current.onZoom(z);
      });
      m.on("moveend", () => {
        setBounds(m.getBounds());
        pushAssets(m);
      });

      // Drag pins to reposition them
      m.on("mousedown", "asset-pins", (e) => {
        if (latest.current.mode.kind !== "idle") return;
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (!id) return;
        e.preventDefault();
        let moved = false;
        const onMove = (ev: MapMouseEvent) => {
          if (!moved) setHover(null);
          moved = true;
          m.getCanvas().style.cursor = "grabbing";
          dragRef.current = { id, pos: [ev.lngLat.lng, ev.lngLat.lat] };
          pushAssets(m);
        };
        m.on("mousemove", onMove);
        m.once("mouseup", () => {
          m.off("mousemove", onMove);
          m.getCanvas().style.cursor = "";
          const drag = dragRef.current;
          dragRef.current = null;
          if (moved && drag) {
            justDraggedRef.current = Date.now();
            latest.current.onMoveAsset(drag.id, drag.pos);
            latest.current.onSelectAsset(drag.id);
          }
        });
      });

      m.on("click", (e) => {
        const P = latest.current;
        const pos: LngLat = [e.lngLat.lng, e.lngLat.lat];

        if (P.mode.kind === "place") {
          P.onPlaceAsset(P.mode.typeId, pos);
          return;
        }
        if (P.mode.kind === "draw") {
          const d = P.draft;
          if (d.length >= 3 && m.project(d[0]).dist(e.point) < 12) return P.onDraftFinish();
          if (d.length && m.project(d[d.length - 1]).dist(e.point) < 5) return;
          P.onDraftAdd(pos);
          return;
        }
        if (Date.now() - justDraggedRef.current < 300) return;

        const hits = safeQuery(m, e.point, ["clusters", "asset-pins", "geofence-fill"]);
        const cluster = hits.find((f) => f.layer?.id === "clusters");
        if (cluster && cluster.geometry.type === "Point") {
          const center = cluster.geometry.coordinates as LngLat;
          const minZoom = normalizeSettings(P.settings).clusterBelowZoom + 0.05;
          // A lone asset's “1” bubble: go to it at the markers tier.
          if (cluster.properties?.cluster_id == null) {
            m.easeTo({ center, zoom: Math.max(m.getZoom(), minZoom), duration: 600 });
            return;
          }
          (m.getSource("asset-clusters") as GeoJSONSource).getClusterExpansionZoom(cluster.properties?.cluster_id, (err, z) => {
            if (err || z == null) return;
            // Zoom in to where the cluster splits, but never past the markers tier.
            m.easeTo({ center, zoom: Math.min(Math.max(z + 0.25, m.getZoom() + 1), minZoom), duration: 600 });
          });
          return;
        }
        const pin = hits.find((f) => f.layer?.id === "asset-pins");
        if (pin) return P.onSelectAsset(pin.properties?.id);
        const fence = hits.find((f) => f.layer?.id === "geofence-fill");
        P.onSelectAsset(null);
        P.onSelectGeofence(fence ? fence.properties?.id : null);
      });

      m.on("dblclick", (e) => {
        const P = latest.current;
        if (P.mode.kind === "draw") {
          e.preventDefault();
          if (P.draft.length >= 3) P.onDraftFinish();
        }
      });

      m.on("mousemove", (e) => {
        const P = latest.current;
        const ghost = ghostRef.current;
        if (ghost) {
          ghost.style.transform = `translate(${e.point.x}px, ${e.point.y}px)`;
          ghost.style.opacity = P.mode.kind === "idle" ? "0" : "1";
        }

        if (P.mode.kind === "draw") {
          cursorRef.current = [e.lngLat.lng, e.lngLat.lat];
          const closing = P.draft.length >= 3 && m.project(P.draft[0]).dist(e.point) < 12;
          m.getCanvas().style.cursor = closing ? "pointer" : "crosshair";
          setHint(
            closing ? "Click to close shape"
              : P.draft.length === 0 ? "Click to start the geofence"
              : P.draft.length < 3 ? `Click to add point (${3 - P.draft.length} more needed)`
              : "Click to add · double-click or click first point to finish",
          );
          pushDraft(m);
          return;
        }
        if (P.mode.kind !== "idle" || dragRef.current) return;

        // Pointer is over an HTML image marker — it manages its own hover.
        if ((e.originalEvent.target as HTMLElement | null)?.closest?.(".img-marker-host")) return;

        const hits = safeQuery(m, e.point, ["asset-pins", "clusters", "geofence-fill"]);
        const pin = hits.find((f) => f.layer?.id === "asset-pins");
        const cluster = hits.find((f) => f.layer?.id === "clusters");
        const fence = hits.find((f) => f.layer?.id === "geofence-fill");

        setBubbleHover(m, !pin && cluster ? (cluster.properties?.cluster_id == null ? { assetId: cluster.properties?.id } : { clusterId: cluster.id }) : null);
        if (pin) setHover({ kind: "asset", id: pin.properties?.id });
        else setHover(null);

        m.getCanvas().style.cursor = pin ? "grab" : cluster || fence ? "pointer" : "";
      });

      m.getCanvas().addEventListener("mouseleave", () => {
        if (ghostRef.current) ghostRef.current.style.opacity = "0";
        cursorRef.current = null;
        pushDraft(m);
        setBubbleHover(m, null);
      });
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      created?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Data sync */
  useEffect(() => {
    if (map?.isStyleLoaded()) pushAssets(map);
     
  }, [assets, selectedAssetId, map]);

  useEffect(() => {
    if (map?.isStyleLoaded()) pushGeofences(map);
     
  }, [geofences, selectedGeofenceId, map]);

  useEffect(() => {
    if (mode.kind !== "draw") cursorRef.current = null;
    if (map?.isStyleLoaded()) pushDraft(map);
     
  }, [draft, mode, map]);

  /* Zoom thresholds changed → rebuild clustered source + layer zoom ranges */
  useEffect(() => {
    const m = mapRef.current;
    if (m?.isStyleLoaded()) {
      reinstall(m);
      pushAssets(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.clusterBelowZoom, settings.imageFromZoom]);

  /* Style switch (layers are re-added on style.load) */
  const styleRef = useRef(settings.mapStyle);
  useEffect(() => {
    if (styleRef.current === settings.mapStyle) return;
    styleRef.current = settings.mapStyle;
    mapRef.current?.setStyle(styleUrl(settings.mapStyle));
  }, [settings.mapStyle]);

  /* Mode → cursor, double-click zoom, hints */
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = mode.kind === "idle" ? "" : "crosshair";
    if (mode.kind === "draw") map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    /* eslint-disable react-hooks/set-state-in-effect -- reset transient UI when the mode changes */
    setHint(mode.kind === "draw" ? "Click to start the geofence" : null);
    if (mode.kind !== "idle") setHover(null);
    /* eslint-enable react-hooks/set-state-in-effect */
     
  }, [mode, map]);

  /* Fly to */
  useEffect(() => {
    const m = mapRef.current;
    const mb = mbRef.current;
    if (!m || !mb || !flyTarget) return;
    if (flyTarget.kind === "point") {
      m.flyTo({ center: flyTarget.center, zoom: flyTarget.zoom ?? Math.max(m.getZoom(), settings.imageFromZoom + 0.5), offset: flyTarget.offset ?? [0, 0], duration: 1200 });
    } else if (flyTarget.points.length) {
      const b = new mb.LngLatBounds(flyTarget.points[0], flyTarget.points[0]);
      flyTarget.points.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: flyTarget.padding ?? 80, duration: 1000, maxZoom: flyTarget.maxZoom ?? 18 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTarget?.nonce]);

  /* Image-style HTML markers when zoomed in past the threshold */
  const tier: ZoomTier = zoom >= settings.imageFromZoom ? "images" : zoom < settings.clusterBelowZoom ? "clusters" : "markers";
  const imageMode = tier === "images";
  const focusId = props.focusVehicle?.id ?? null;
  const focusKeyIds = (props.focusKeys ?? []).map((k) => k.id).join(",");
  const dimmed = !!focusId || !!props.dim;
  useEffect(() => {
    const mb = mbRef.current;
    if (!map || !mb) return;
    const store = markersRef.current;

    let visible: Asset[] = [];
    if (imageMode && bounds) {
      const pad = 0.3;
      const w = bounds.getWest(), e = bounds.getEast(), s = bounds.getSouth(), n = bounds.getNorth();
      const dx = (e - w) * pad, dy = (n - s) * pad;
      visible = assets.filter(({ id, position: [x, y] }) => id !== focusId && x >= w - dx && x <= e + dx && y >= s - dy && y <= n + dy);
    }
    const wanted = new Set(visible.map((a) => a.id));

    for (const [id, { marker }] of store) {
      if (!wanted.has(id)) {
        marker.remove();
        store.delete(id);
      }
    }
    for (const a of visible) {
      const existing = store.get(a.id);
      if (existing) {
        existing.marker.setLngLat(a.position);
        continue;
      }
      const isKey = TYPE_BY_ID[a.typeId]?.kind === "key";
      const el = document.createElement("div");
      el.className = `img-marker-host group${dimmed ? " is-dim" : ""}`;
      const marker = new mb.Marker({ element: el, anchor: isKey ? "center" : "bottom", offset: isKey ? [0, 0] : [0, 1], draggable: true })
        .setLngLat(a.position)
        .addTo(map);
      marker.on("dragstart", () => {
        el.classList.add("is-dragging");
        setHover(null);
      });
      marker.on("dragend", () => {
        el.classList.remove("is-dragging");
        const ll = marker.getLngLat();
        latest.current.onMoveAsset(a.id, [ll.lng, ll.lat]);
        latest.current.onSelectAsset(a.id);
      });
      el.addEventListener("mouseenter", () => {
        if (latest.current.mode.kind === "idle" && !el.classList.contains("is-dragging")) setHover({ kind: "asset", id: a.id });
      });
      el.addEventListener("mouseleave", () => {
        if (hoverRef.current?.kind === "asset" && hoverRef.current.id === a.id) setHover(null);
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (latest.current.mode.kind === "idle") latest.current.onSelectAsset(a.id);
      });
      store.set(a.id, { marker, el });
    }
     
    setPortals([...store].map(([id, { el }]) => [id, el]));
     
  }, [imageMode, assets, bounds, map, focusId, dimmed]);

  /* Focus / dim: re-push data (focused assets leave the layers) and fade everything else */
  useEffect(() => {
    // Layers exist even while tiles are still loading mid-flight (isStyleLoaded can be false then).
    if (!map?.getLayer("asset-pins")) return;
    pushAssets(map);
    applyDim(map, dimmed);
    markersRef.current.forEach(({ el }) => el.classList.toggle("is-dim", dimmed));
  }, [map, focusId, focusKeyIds, dimmed]);

  /* V0 Keys view: hovering a key dims everything else; leaving restores the focus / dim state */
  const keyHoverId =
    props.dimOnKeyHover && hover?.kind === "asset" && TYPE_BY_ID[assets.find((a) => a.id === hover.id)?.typeId ?? ""]?.kind === "key" ? hover.id : null;
  useEffect(() => {
    if (!map?.getLayer("asset-pins")) return;
    if (keyHoverId) applyDimExcept(map, keyHoverId);
    else {
      applyDim(map, dimmed);
      map.setLayoutProperty("asset-pins", "icon-image", pinIconExpr(hoverRef.current?.kind === "asset" ? hoverRef.current.id : null, dimmed));
    }
    markersRef.current.forEach(({ el }, id) => el.classList.toggle("is-dim", keyHoverId ? id !== keyHoverId : dimmed));
  }, [map, keyHoverId, dimmed]);

  /* Drop from the sidebar palette */
  const onDrop = (e: React.DragEvent) => {
    const typeId = e.dataTransfer.getData(ASSET_DRAG_MIME);
    const m = mapRef.current;
    if (!typeId || !m || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const ll = m.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    props.onPlaceAsset(typeId, [ll.lng, ll.lat]);
  };

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const placingType = mode.kind === "place" ? TYPE_BY_ID[mode.typeId] : null;
  const hoveredAsset = hover?.kind === "asset" ? assetById.get(hover.id) : undefined;

  return (
    <div
      className={`relative h-full w-full ${mode.kind !== "idle" ? "map-mode-edit" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(ASSET_DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={onDrop}
    >
      <div ref={containerRef} className="h-full w-full" />

      {map && hoveredAsset && (
        <MapPopover map={map} at={hoveredAsset.position} offset={previewOffset(hoveredAsset, tier)}>
          <AssetPreview asset={hoveredAsset} />
        </MapPopover>
      )}

      {/* Cursor follower: label while placing, hint while drawing */}
      <div ref={ghostRef} className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity">
        {placingType && (
          <div className="-translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md bg-[#111]/90 px-2 py-1 text-[12px] font-medium text-white shadow">
            Drop {placingType.name}
          </div>
        )}
        {mode.kind === "draw" && hint && (
          <div className="translate-x-3 translate-y-3 whitespace-nowrap rounded-md bg-[#111]/90 px-2 py-1 text-[12px] font-medium text-white shadow">{hint}</div>
        )}
      </div>

      {map && props.focusVehicle && <FocusOverlay map={map} vehicle={props.focusVehicle} keys={props.focusKeys ?? []} activeKeyId={props.focusKeyId} onPickKey={props.onPickFocusKey} />}

      {portals.map(([id, el]) => {
        const a = assetById.get(id);
        return a ? createPortal(<AssetMarker asset={a} active={a.id === selectedAssetId} />, el, id) : null;
      })}
    </div>
  );
}
