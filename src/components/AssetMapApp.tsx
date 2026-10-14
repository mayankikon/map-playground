"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MbMap } from "mapbox-gl";
import { FileCode2, PenLine, X } from "lucide-react";

import MapView from "./MapView";
import { HandoffPanel } from "./handoff";
import { VersionContext } from "./version";
import AssetDetail from "./AssetDetail";
import { GroupKeysOverlay, RoomKeysOverlay } from "./focus";
import { HubMarkers, KeyLocationPanel, KeysTab, buildLocations } from "./keyHubs";
import VehicleDetailPanel from "./vehicleDetail";
import { AssetTypeToggle, batteryLow, EMPTY_FILTERS, FilterBar, GeofenceSelect, Legend, MapBar, NavRail, TopBar, VehicleListPanel, applyFilters, type Filters } from "./toolbox";
import { DEFAULT_SETTINGS, INITIAL_VIEW, TYPE_BY_ID, inView, isLngLat, normalizeSettings } from "@/lib/catalog";
import { pointInPolygon } from "@/lib/geo";
import { seedAssets, seedGeofences, seedToyotaAssets, seedToyotaGeofence } from "@/lib/seed";
import { keysByLocation, seedHubKeys, seedLooseKeys, type KeyLocationId } from "@/lib/hubs";
import { type AppVersion, type Asset, type DisplaySettings, type AssetView, type FlyRequest, type FlyTarget, type Geofence, type LngLat, type MapStyleId, type Mode } from "@/lib/types";

const STORAGE_KEY = "asset-map:v2";
/** Room / In Lot / Off Lot photos uploaded in the app, by location id (kept apart from the asset data, they are large). */
const ROOM_IMAGES_KEY = "asset-map:room-images";
const HANDOFF_KEY = "asset-map:handoff";
const VERSION_KEY = "asset-map:version";

/** Bump when DEFAULT_SETTINGS change so older saved display settings fall back to the new defaults. */
const SETTINGS_VERSION = 8;

interface Persisted {
  assets: Asset[];
  geofences: Geofence[];
  settings: DisplaySettings;
  settingsVersion?: number;
  /** Demo data generations already merged into this save. */
  seedVersion?: number;
}

/**
 * 2 = Toyota of Grapevine lot, 3 = keys paired to vehicles and stored in key locations,
 * 4 = Toyota lot re-parked with ~100 scattered vehicles (keys re-paired), overlap demo assets removed,
 * 5 = Toyota of Grapevine only: every other geofence and the assets outside it are removed,
 * 6 = two keys paired to every vehicle, all stored in the building's rooms.
 * Older saves are upgraded once, keeping the user's own data.
 */
const SEED_VERSION = 9;

/** Zoom from which key locations show as their own markers. */
const HUB_ZOOM = 16;

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

function newAsset(id: string, typeId: string, position: LngLat, address?: string): Asset {
  const t = TYPE_BY_ID[typeId];
  if (t.kind === "vehicle") {
    const vin = Array.from({ length: 17 }, () => "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"[Math.floor(Math.random() * 33)]).join("");
    const isNew = t.age === "new";
    return {
      id, typeId, position, reporting: true,
      year: isNew ? 2025 : 2021, make: "Chevrolet", model: "Equinox", vin, stock: vin.slice(-7),
      condition: isNew ? "New" : "Preowned", price: isNew ? 29450 : 21900, miles: isNew ? 12 : 38120,
    };
  }
  if (t.kind === "key") return { id, typeId, position, reporting: true, code: digits(7), address: address ?? "" };
  return { id, typeId, position, reporting: false, code: digits(11), address: address ?? "" };
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export default function AssetMapApp() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom);
  const [view, setView] = useState<AssetView>("vehicles");
  /** Where the "Map" button returns to after Satellite (Streets unless another style was in use). */
  const [lastMapStyle, setLastMapStyle] = useState<MapStyleId>("streets");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [listOpen, setListOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  // Handoff panel starts open; dismissing it is remembered per browser.
  const [handoffOpen, setHandoffOpen] = useState(true);
  const [version, setVersion] = useState<AppVersion>("v2");
  const changeVersion = (v: AppVersion) => {
    setVersion(v);
    try {
      localStorage.setItem(VERSION_KEY, v);
    } catch {
      /* storage unavailable */
    }
  };
  const toggleHandoff = (open: boolean) => {
    setHandoffOpen(open);
    try {
      localStorage.setItem(HANDOFF_KEY, open ? "open" : "closed");
    } catch {
      /* storage unavailable */
    }
  };
  const [bearing, setBearing] = useState(0);
  const mapRef = useRef<MbMap | null>(null);
  const [mapObj, setMapObj] = useState<MbMap | null>(null);
  const [openLocationId, setOpenLocationId] = useState<KeyLocationId | null>(null);
  const [hoveredRoomKeyId, setHoveredRoomKeyId] = useState<string | null>(null);
  const [roomImages, setRoomImages] = useState<Record<string, string>>({});
  /** Vehicle whose editable card is open next to its details page ("Edit details"). */
  const [editingId, setEditingId] = useState<string | null>(null);

  /* Persistence */
  useEffect(() => {
    const saved = load();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    let savedAssets = saved?.assets?.filter((a) => isLngLat(a.position));
    let savedFences = saved?.geofences?.filter((g) => g.points.every(isLngLat));
    if (saved && (saved.seedVersion ?? 1) < 2) {
      savedAssets = [...(savedAssets ?? []), ...seedToyotaAssets()];
      savedFences = [seedToyotaGeofence(), ...(savedFences ?? [])];
    } else if (saved && (saved.seedVersion ?? 1) < 4 && savedAssets) {
      // Re-park the Toyota lot (~100 scattered vehicles, freshly paired keys); drop overlap demo assets.
      const kept = savedAssets.filter((a) => !/^tgv-(v|d|k|hk)-/.test(a.id) && !a.id.startsWith("demo-"));
      savedAssets = [...kept, ...seedToyotaAssets()];
    }
    if (saved && (saved.seedVersion ?? 1) < 5) {
      // Keep only Toyota of Grapevine: its geofence and whatever sits inside it.
      const toyota = seedToyotaGeofence();
      savedFences = [toyota];
      savedAssets = (savedAssets ?? []).filter((a) => a.id.startsWith("tgv-") || pointInPolygon(a.position, toyota.points));
    }
    if (saved && (saved.seedVersion ?? 1) < 9 && savedAssets) {
      // Every vehicle gets one or two keys: most in the building's rooms, a few in the lot or off it.
      const kept = savedAssets.filter((a) => !a.id.startsWith("tgv-hk-") && !a.id.startsWith("tgv-lk-"));
      const vehicles = kept.filter((a) => a.id.startsWith("tgv-v-"));
      const hubKeys = seedHubKeys(vehicles);
      savedAssets = [...kept, ...hubKeys, ...seedLooseKeys(vehicles, hubKeys)];
    }
    setAssets(savedAssets ?? seedAssets());
    setGeofences(savedFences ?? seedGeofences());
    setSettings(saved?.settingsVersion === SETTINGS_VERSION ? normalizeSettings(saved.settings) : DEFAULT_SETTINGS);
    try {
      if (localStorage.getItem(HANDOFF_KEY) === "closed") setHandoffOpen(false);
      if (localStorage.getItem(VERSION_KEY) === "v1") setVersion("v1");
    } catch {
      /* storage unavailable */
    }
    try {
      const imgs = JSON.parse(localStorage.getItem(ROOM_IMAGES_KEY) ?? "{}");
      if (imgs && typeof imgs === "object") setRoomImages(imgs);
    } catch {
      /* ignore bad saved photos */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ assets, geofences, settings, settingsVersion: SETTINGS_VERSION, seedVersion: SEED_VERSION } satisfies Persisted));
    } catch {
      /* storage full or unavailable — keep working in memory */
    }
  }, [assets, geofences, settings, hydrated]);

  /* Derived: which geofences contain each asset */
  const membership = useMemo(() => {
    const byAsset = new Map<string, Geofence[]>();
    const countByFence = new Map<string, number>();
    for (const g of geofences) {
      if (g.points.length < 3) continue;
      for (const a of assets) {
        if (!pointInPolygon(a.position, g.points)) continue;
        byAsset.set(a.id, [...(byAsset.get(a.id) ?? []), g]);
        countByFence.set(g.id, (countByFence.get(g.id) ?? 0) + 1);
      }
    }
    return { byAsset, countByFence };
  }, [assets, geofences]);

  const fly = useCallback((t: FlyRequest) => setFlyTarget({ ...t, nonce: Date.now() }), []);

  /* Assets */
  const placeAsset = useCallback(
    (typeId: string, position: LngLat) => {
      const type = TYPE_BY_ID[typeId];
      if (!type) return;
      const id = uid();
      const lot = geofences.find((g) => g.points.length >= 3 && pointInPolygon(position, g.points));
      setAssets((prev) => [...prev, newAsset(id, typeId, position, lot?.address)]);
      setView((v) => (v === "all" ? v : type.kind === "key" ? "keys" : "vehicles"));
      setSelectedAssetId(id);
      setSelectedGeofenceId(null);
    },
    [geofences],
  );

  const moveAsset = useCallback((id: string, position: LngLat) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, position } : a)));
  }, []);

  const updateAsset = useCallback((id: string, patch: Partial<Asset>) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelectedAssetId((s) => (s === id ? null : s));
  }, []);

  const selectAsset = useCallback((id: string | null) => {
    setSelectedAssetId(id);
    if (id) setSelectedGeofenceId(null);
  }, []);

  /* Geofences */
  const finishDraft = useCallback(() => {
    if (draft.length < 3) return;
    const id = uid();
    const points = draft;
    setGeofences((prev) => [
      ...prev,
      { id, name: `Geofence ${prev.length + 1}`, address: "", points, visible: true },
    ]);
    setSelectedGeofenceId(id);
    setMode({ kind: "idle" });
    setDraft([]);
  }, [draft]);

  const cancelMode = useCallback(() => {
    setMode({ kind: "idle" });
    setDraft([]);
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Escape") {
        if (mode.kind !== "idle") cancelMode();
        else {
          setSelectedAssetId(null);
          setSelectedGeofenceId(null);
        }
      } else if (mode.kind === "draw" && e.key === "Enter") {
        finishDraft();
      } else if (mode.kind === "draw" && (e.key === "Backspace" || ((e.metaKey || e.ctrlKey) && e.key === "z"))) {
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
      } else if (mode.kind === "idle" && (e.key === "Delete" || e.key === "Backspace") && selectedAssetId) {
        deleteAsset(selectedAssetId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, selectedAssetId, cancelMode, finishDraft, deleteAsset]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const visibleAssets = useMemo(() => assets.filter((a) => inView(a, view)), [assets, view]);
  const shownAssets = useMemo(() => applyFilters(visibleAssets, filters, query), [visibleAssets, filters, query]);
  // From HUB_ZOOM, keys stored in a key location are drawn as that location's marker, not one by
  // one; zoomed further out they simply count toward the clusters.
  const hubsVisible = zoom >= HUB_ZOOM;
  const openGroupKeyIds = useMemo(() => {
    const loc = openLocationId?.startsWith("group:") ? keysByLocation(assets, geofences).get(openLocationId) : undefined;
    return new Set((loc ?? []).map((k) => k.id));
  }, [openLocationId, assets, geofences]);
  const mapAssets = useMemo(
    () => shownAssets.filter((a) => !(hubsVisible && a.typeId === "key" && a.hubId) && !openGroupKeyIds.has(a.id)),
    [shownAssets, hubsVisible, openGroupKeyIds],
  );
  const vehicleById = useMemo(() => new Map(assets.filter((a) => a.typeId.startsWith("vehicle")).map((a) => [a.id, a])), [assets]);
  const locations = useMemo(() => buildLocations(keysByLocation(assets, geofences), roomImages, version), [assets, geofences, roomImages, version]);
  const setRoomImage = (locationId: string, dataUrl: string) => {
    const next = { ...roomImages, [locationId]: dataUrl };
    setRoomImages(next);
    try {
      localStorage.setItem(ROOM_IMAGES_KEY, JSON.stringify(next));
    } catch {
      /* storage full: the photo still shows for this session */
    }
  };
  const openLocation = locations.find((l) => l.id === openLocationId) ?? null;
  const listTab = view === "keys" ? "keys" : "vehicles";
  const showKeys = view !== "vehicles";

  const selectedIsVehicle = !!selectedAsset && TYPE_BY_ID[selectedAsset.typeId]?.kind === "vehicle";
  const pairedKeys = useMemo(() => {
    if (!selectedAsset || !selectedIsVehicle) return [];
    return assets
      .filter((a) => a.typeId === "key" && a.vehicleId === selectedAsset.id)
      .map((key) => {
        const loc = locations.find((l) => l.keys.includes(key));
        return { key, locationName: loc?.name ?? "Unknown", position: loc?.hub?.position ?? key.position };
      });
  }, [assets, locations, selectedAsset, selectedIsVehicle]);

  // The selected vehicle's paired keys, shown on the map with it (whatever the view).
  const focusKeys = useMemo(
    () => (selectedIsVehicle && selectedAsset ? assets.filter((a) => a.typeId === "key" && a.vehicleId === selectedAsset.id) : []),
    [assets, selectedAsset, selectedIsVehicle],
  );

  const openKeyLocation = (id: KeyLocationId) => {
    setOpenLocationId(id);
    setSelectedAssetId(null);
    if (view === "vehicles") setView("keys");
    if (viewMode === "list") setViewMode("map");
    const loc = locations.find((l) => l.id === id);
    // Land the room right of its key panel (left 16 + 450px); its key tags scatter around it.
    if (loc?.hub) fly({ kind: "point", center: loc.hub.position, zoom: Math.max(zoom, 18.6), offset: [233, 0] });
    else if (loc?.keys.length) {
      const w = mapRef.current?.getContainer().clientWidth ?? 1200;
      const left = Math.min(500, Math.max(40, w - 260));
      fly({ kind: "bounds", points: loc.keys.map((k) => k.position), padding: { top: 120, bottom: 80, left, right: Math.min(80, Math.max(20, w - left - 200)) }, maxZoom: 18.5 });
    }
  };
  /** Key ID clicked: open the vehicle it belongs to, but center the map on the key. */
  const openKeyVehicle = (keyId: string) => {
    const k = assets.find((a) => a.id === keyId);
    if (!k) return;
    selectAsset(k.vehicleId && vehicleById.has(k.vehicleId) ? k.vehicleId : k.id);
    fly({ kind: "point", center: k.position, zoom: Math.max(zoom, settings.clusterBelowZoom + 0.5) });
  };
  /** Vehicle clicked: open it and go to it. */
  /**
   * Frame a vehicle together with its key tags (they live in the building, often off-screen),
   * leaving room for the details panel on the left. Returns false if it has no keys.
   */
  const frameVehicleWithKeys = (vehicleId: string, onlyIfHidden = false) => {
    const v = vehicleById.get(vehicleId);
    const keys = assets.filter((a) => a.typeId === "key" && a.vehicleId === vehicleId);
    if (!v || !keys.length) return false;
    const pts = [v.position, ...keys.map((k) => k.position)];
    const b = mapRef.current?.getBounds();
    if (onlyIfHidden && b && pts.every((p) => b.contains(p))) return true;
    // Padding must leave some map: on narrow screens the panel side shrinks to fit.
    const el = mapRef.current?.getContainer();
    const w = el?.clientWidth ?? 1200;
    const h = el?.clientHeight ?? 800;
    const left = Math.min(460, Math.max(40, w - 260));
    const pad = { top: Math.min(150, h * 0.3), bottom: Math.min(60, h * 0.1), left, right: Math.min(90, Math.max(20, w - left - 200)) };
    fly({ kind: "bounds", points: pts, padding: pad, maxZoom: 19.5 });
    return true;
  };
  const openVehicle = (vehicleId: string) => {
    const v = vehicleById.get(vehicleId);
    if (!v) return;
    selectAsset(v.id);
    if (!frameVehicleWithKeys(v.id)) fly({ kind: "point", center: v.position, zoom: Math.max(zoom, settings.clusterBelowZoom + 0.5) });
  };

  const isSatellite = settings.mapStyle === "satellite";
  const placingType = mode.kind === "place" ? TYPE_BY_ID[mode.typeId] : null;

  const selectAndFly = (id: string) => {
    selectAsset(id);
    const a = assets.find((x) => x.id === id);
    if (a && !inView(a, view)) setView(TYPE_BY_ID[a.typeId]?.kind === "key" ? "keys" : "vehicles");
    if (a && !(a.typeId.startsWith("vehicle") && frameVehicleWithKeys(a.id))) fly({ kind: "point", center: a.position });
    if (viewMode === "list") setViewMode("map");
  };
  const selectGeofence = (id: string) => {
    setSelectedGeofenceId(id);
    setSelectedAssetId(null);
    const g = geofences.find((x) => x.id === id);
    if (g) fly({ kind: "bounds", points: g.points });
  };

  return (
    <VersionContext value={version}>
    <div className="flex h-dvh w-full overflow-hidden bg-white text-[#111]">
      <NavRail version={version} onVersion={changeVersion} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar query={query} onQuery={setQuery} />

        <div className="flex min-h-0 flex-1">
          {listOpen && viewMode === "map" && (
            <VehicleListPanel
              assets={shownAssets}
              view={view}
              selectedId={selectedAssetId}
              onSelect={selectAndFly}
              onCollapse={() => setListOpen(false)}
              tab={listTab}
              onTab={(t) => {
                setView(t);
                if (t === "vehicles") setOpenLocationId(null);
                if (selectedAsset && !inView(selectedAsset, t)) setSelectedAssetId(null);
              }}
              keysContent={<KeysTab locations={locations} selectedId={openLocationId} onOpen={openKeyLocation} />}
            />
          )}

          <main className="relative min-w-0 flex-1 border-l border-[#dcdcdc]">
            {hydrated && (
              <MapView
                assets={mapAssets}
                geofences={geofences}
                settings={settings}
                mode={mode}
                draft={draft}
                selectedAssetId={selectedAssetId}
                selectedGeofenceId={selectedGeofenceId}
                flyTarget={flyTarget}
                onPlaceAsset={placeAsset}
                onMoveAsset={moveAsset}
                onSelectAsset={(id) => {
                  selectAsset(id);
                  if (id && vehicleById.has(id)) frameVehicleWithKeys(id, true);
                }}
                onSelectGeofence={setSelectedGeofenceId}
                onDraftAdd={(p) => setDraft((d) => [...d, p])}
                onDraftFinish={finishDraft}
                onZoom={setZoom}
                focusVehicle={selectedIsVehicle ? selectedAsset : null}
                focusKeys={focusKeys}
                dim={!!openLocation && showKeys && viewMode === "map"}
                onReady={(m) => {
                  mapRef.current = m;
                  setMapObj(m);
                  // Open framed on the Toyota of Grapevine geofence.
                  const fence = geofences.find((g) => g.id === "lot-toyota-grapevine")?.points;
                  if (fence?.length) {
                    const xs = fence.map((p) => p[0]);
                    const ys = fence.map((p) => p[1]);
                    m.fitBounds(
                      [
                        [Math.min(...xs), Math.min(...ys)],
                        [Math.max(...xs), Math.max(...ys)],
                      ],
                      { padding: { top: 80, bottom: 40, left: 40, right: 80 }, duration: 0 },
                    );
                  }
                  m.on("rotate", () => setBearing(m.getBearing()));
                }}
              />
            )}

            {viewMode === "list" && (
              <div className="absolute inset-0 z-20 bg-white pt-[72px]">
                <VehicleListPanel
                  assets={shownAssets}
                  view={view}
                  selectedId={selectedAssetId}
                  onSelect={selectAndFly}
                  full
                  tab={listTab}
                  onTab={(t) => setView(t)}
                  keysContent={<KeysTab locations={locations} selectedId={openLocationId} onOpen={openKeyLocation} />}
                />
              </div>
            )}

            <FilterBar filters={filters} onFilters={setFilters} mode={viewMode} onMode={setViewMode} />

            {!listOpen && viewMode === "map" && (
              <button
                type="button"
                onClick={() => setListOpen(true)}
                aria-label="Show list"
                className="absolute left-0 top-[80px] z-20 rounded-r-[4px] border border-l-0 border-[#dcdcdc] bg-white py-2 pl-1 pr-1.5 shadow-[0_1px_3px_rgba(0,0,0,.2)] hover:bg-[#f4f4f4]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
                <img alt="" src="/figma/app/panel-collapse.svg" className="size-6 -scale-x-100" />
              </button>
            )}

            {viewMode === "map" && mapObj && openLocation && showKeys && (
              openLocation.hub ? (
                <RoomKeysOverlay map={mapObj} center={openLocation.hub.position} keys={openLocation.keys} highlightId={hoveredRoomKeyId} onOpenKey={openKeyVehicle} />
              ) : (
                // In Lot / Off Lot: each key tag where the key actually is.
                <GroupKeysOverlay map={mapObj} keys={openLocation.keys} highlightId={hoveredRoomKeyId} onOpenKey={openKeyVehicle} />
              )
            )}

            {viewMode === "map" && mapObj && showKeys && hubsVisible && (
              <HubMarkers map={mapObj} locations={locations} selectedId={openLocationId} onOpen={openKeyLocation} />
            )}

            {viewMode === "map" && openLocation && showKeys && (
              <KeyLocationPanel
                key={openLocation.id}
                location={openLocation}
                vehicleById={vehicleById}
                selectedKeyId={selectedAssetId}
                onOpenKey={openKeyVehicle}
                onOpenVehicle={openVehicle}
                onHoverKey={setHoveredRoomKeyId}
                onRoomImage={version === "v2" ? setRoomImage : undefined}
                onClose={() => setOpenLocationId(null)}
              />
            )}

            {viewMode === "map" && (
              <>
                {/* Vehicle / key toggle (right edge, below the view toggle) */}
                <div className="absolute right-4 top-[80px] z-20">
                  <AssetTypeToggle
                    view={view}
                    onView={(v) => {
                      setView(v);
                      if (v === "vehicles") setOpenLocationId(null);
                      if (selectedAsset && !inView(selectedAsset, v)) setSelectedAssetId(null);
                    }}
                  />
                </div>

                {/* Bottom-right: geofence + legend, then the map bar */}
                <div className="pointer-events-none absolute bottom-7 right-4 z-20 flex items-end gap-4">
                  <div className="pointer-events-auto flex flex-col items-end gap-4">
                    <GeofenceSelect geofences={geofences} selectedId={selectedGeofenceId} onSelect={selectGeofence} />
                    <Legend />
                  </div>
                  <div className="pointer-events-auto">
                    <MapBar
                      satellite={isSatellite}
                      bearing={bearing}
                      onLayers={() => {
                        if (!isSatellite) setLastMapStyle(settings.mapStyle);
                        setSettings((s) => normalizeSettings({ ...s, mapStyle: isSatellite ? lastMapStyle : "satellite" }));
                      }}
                      onZoomIn={() => mapRef.current?.zoomIn()}
                      onZoomOut={() => mapRef.current?.zoomOut()}
                      onNorth={() => mapRef.current?.resetNorthPitch()}
                    />
                  </div>
                </div>

                {/* Engineering handoff: dismissible spec panel; reopened from the button below. */}
                {handoffOpen ? (
                  <HandoffPanel settings={normalizeSettings(settings)} zoom={zoom} version={version} onClose={() => toggleHandoff(false)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleHandoff(true)}
                    className="absolute bottom-7 right-[358px] z-30 flex items-center gap-2 rounded-[4px] border border-[#dcdcdc] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#111] shadow-[0_1px_3px_rgba(0,0,0,.2)] hover:border-[#99a3ad]"
                  >
                    <FileCode2 size={16} className="text-brand" />
                    Handoff specs
                  </button>
                )}
              </>
            )}

            {/* Mode banner */}
            {mode.kind !== "idle" && (
              <div className="pointer-events-none absolute inset-x-0 top-[76px] z-30 flex justify-center px-4">
                <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#111] py-1.5 pl-3 pr-1.5 text-sm text-white shadow-xl">
                  {placingType ? (
                    <>
                      <span className="h-3 w-3 rounded-full ring-2 ring-white/30" style={{ background: placingType.color }} />
                      <span>
                        Placing <b>{placingType.name}</b> — click the map to drop, as many as you like
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand">
                        <PenLine size={14} />
                      </span>
                      <span>
                        Drawing geofence · <b>{draft.length}</b> point{draft.length === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => setDraft((d) => d.slice(0, -1))}
                        disabled={!draft.length}
                        className="rounded-full px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40"
                      >
                        Undo
                      </button>
                      <button
                        onClick={finishDraft}
                        disabled={draft.length < 3}
                        className="rounded-full bg-brand px-3 py-1 text-xs font-medium hover:bg-brand-hover disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        Finish
                      </button>
                    </>
                  )}
                  <button onClick={cancelMode} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10" aria-label="Exit mode">
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {selectedAsset && viewMode === "map" && selectedIsVehicle && (
              <VehicleDetailPanel
                key={selectedAsset.id}
                vehicle={selectedAsset}
                geofences={membership.byAsset.get(selectedAsset.id) ?? []}
                keys={pairedKeys}
                batteryLow={batteryLow(selectedAsset)}
                onClose={() => {
                  setSelectedAssetId(null);
                  setEditingId(null);
                }}
                onFly={(p) => fly({ kind: "point", center: p, zoom: Math.max(zoom, settings.imageFromZoom + 0.3) })}
                onUpdate={(patch) => updateAsset(selectedAsset.id, patch)}
                onEdit={() => setEditingId(selectedAsset.id)}
                onDelete={() => deleteAsset(selectedAsset.id)}
              />
            )}

            {selectedAsset && viewMode === "map" && (!selectedIsVehicle || editingId === selectedAsset.id) && (
              <AssetDetail
                asset={selectedAsset}
                geofences={membership.byAsset.get(selectedAsset.id) ?? []}
                onChange={(patch) => updateAsset(selectedAsset.id, patch)}
                onDelete={() => deleteAsset(selectedAsset.id)}
                onClose={() => (selectedIsVehicle ? setEditingId(null) : setSelectedAssetId(null))}
                onZoomTo={() => fly({ kind: "point", center: selectedAsset.position, zoom: settings.imageFromZoom + 1 })}
              />
            )}
          </main>
        </div>
      </div>
    </div>
    </VersionContext>
  );
}
