"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Globe, KeyRound, Layers, Map as MapIcon, MapPin, Image as ImageIcon, PenLine, X } from "lucide-react";

import MapView from "./MapView";
import Sidebar, { type SidebarTab } from "./Sidebar";
import AssetDetail from "./AssetDetail";
import { DEFAULT_SETTINGS, INITIAL_VIEW, TYPE_BY_ID, inView, isLngLat, normalizeSettings } from "@/lib/catalog";
import { pointInPolygon } from "@/lib/geo";
import { seedAssets, seedGeofences } from "@/lib/seed";
import { zoomTier, type Asset, type DisplaySettings, type AssetView, type FlyRequest, type FlyTarget, type Geofence, type LngLat, type MapStyleId, type Mode } from "@/lib/types";

const STORAGE_KEY = "asset-map:v2";

/** Bump when DEFAULT_SETTINGS change so older saved display settings fall back to the new defaults. */
const SETTINGS_VERSION = 6;

interface Persisted {
  assets: Asset[];
  geofences: Geofence[];
  settings: DisplaySettings;
  settingsVersion?: number;
}

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

  const [tab, setTab] = useState<SidebarTab>("assets");
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom);
  const [view, setView] = useState<AssetView>("vehicles");
  /** Where the "Map" button returns to after Satellite (Streets unless another style was in use). */
  const [lastMapStyle, setLastMapStyle] = useState<MapStyleId>("streets");

  /* Persistence */
  useEffect(() => {
    const saved = load();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    setAssets(saved?.assets ? saved.assets.filter((a) => isLngLat(a.position)) : seedAssets());
    setGeofences(saved?.geofences ? saved.geofences.filter((g) => g.points.every(isLngLat)) : seedGeofences());
    setSettings(saved?.settingsVersion === SETTINGS_VERSION ? normalizeSettings(saved.settings) : DEFAULT_SETTINGS);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ assets, geofences, settings, settingsVersion: SETTINGS_VERSION } satisfies Persisted));
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
      setView(type.kind === "key" ? "keys" : "vehicles");
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
  const startDraw = useCallback(() => {
    setMode({ kind: "draw" });
    setDraft([]);
    setSelectedAssetId(null);
    setTab("geofences");
  }, []);

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

  const updateGeofence = useCallback((id: string, patch: Partial<Geofence>) => {
    setGeofences((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);

  const deleteGeofence = useCallback((id: string) => {
    setGeofences((prev) => prev.filter((g) => g.id !== id));
    setSelectedGeofenceId((s) => (s === id ? null : s));
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

  const isSatellite = settings.mapStyle === "satellite";
  const tier = zoomTier(zoom, settings);
  const placingType = mode.kind === "place" ? TYPE_BY_ID[mode.typeId] : null;

  const TierIcon = tier === "clusters" ? Layers : tier === "markers" ? MapPin : ImageIcon;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#e8e8e8] text-[#111]">
      <Sidebar
        tab={tab}
        onTab={setTab}
        assets={assets}
        geofences={geofences}
        settings={settings}
        zoom={zoom}
        mode={mode}
        draft={draft}
        membership={membership}
        selectedAssetId={selectedAssetId}
        selectedGeofenceId={selectedGeofenceId}
        onPickType={(typeId) => setMode((m) => (m.kind === "place" && m.typeId === typeId ? { kind: "idle" } : { kind: "place", typeId }))}
        onSelectAsset={(id) => {
          selectAsset(id);
          const a = assets.find((x) => x.id === id);
          if (a && !inView(a, view)) setView(view === "keys" ? "vehicles" : "keys");
          if (a) fly({ kind: "point", center: a.position });
        }}
        onDeleteAsset={deleteAsset}
        onStartDraw={startDraw}
        onUndoPoint={() => setDraft((d) => d.slice(0, -1))}
        onFinishDraw={finishDraft}
        onCancelMode={cancelMode}
        onSelectGeofence={(id) => {
          setSelectedGeofenceId(id);
          setSelectedAssetId(null);
          const g = geofences.find((x) => x.id === id);
          if (g) fly({ kind: "bounds", points: g.points });
        }}
        onUpdateGeofence={updateGeofence}
        onDeleteGeofence={deleteGeofence}
        onSettings={(patch) => setSettings((s) => normalizeSettings({ ...s, ...patch }))}
        onResetDemo={() => {
          setAssets(seedAssets());
          setGeofences(seedGeofences());
          setSelectedAssetId(null);
          setSelectedGeofenceId(null);
        }}
        onClearAll={() => {
          setAssets([]);
          setGeofences([]);
          setSelectedAssetId(null);
          setSelectedGeofenceId(null);
        }}
      />

      <main className="relative min-w-0 flex-1">
        {hydrated && (
          <MapView
            assets={visibleAssets}
            geofences={geofences}
            settings={settings}
            mode={mode}
            draft={draft}
            selectedAssetId={selectedAssetId}
            selectedGeofenceId={selectedGeofenceId}
            flyTarget={flyTarget}
            onPlaceAsset={placeAsset}
            onMoveAsset={moveAsset}
            onSelectAsset={selectAsset}
            onSelectGeofence={setSelectedGeofenceId}
            onDraftAdd={(p) => setDraft((d) => [...d, p])}
            onDraftFinish={finishDraft}
            onZoom={setZoom}
          />
        )}

        {/* Mode banner */}
        {mode.kind !== "idle" && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
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

        {/* Vehicles / Keys toggle */}
        <div
          role="radiogroup"
          aria-label="Assets shown on the map"
          className="absolute right-4 top-4 z-20 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,.14)] ring-1 ring-stroke"
        >
          {(["vehicles", "keys"] as const).map((v) => {
            const active = view === v;
            const count = assets.filter((a) => inView(a, v)).length;
            return (
              <button
                key={v}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setView(v);
                  if (selectedAsset && !inView(selectedAsset, v)) setSelectedAssetId(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-[14px] font-semibold transition ${
                  active ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-canvas hover:text-ink"
                }`}
              >
                {v === "vehicles" ? <Car size={16} /> : <KeyRound size={16} />}
                {v === "vehicles" ? "Vehicles" : "Keys"}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${active ? "bg-white/20" : "bg-canvas"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Map / Satellite switch (sits left of the zoom controls) */}
        <div
          role="radiogroup"
          aria-label="Base map"
          className="absolute bottom-[34px] right-[52px] z-10 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,.14)] ring-1 ring-stroke"
        >
          {([
            { id: "map", label: "Map", Icon: MapIcon, active: !isSatellite, style: lastMapStyle },
            { id: "satellite", label: "Satellite", Icon: Globe, active: isSatellite, style: "satellite" as const },
          ]).map(({ id, label, Icon, active, style }) => (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (style === "satellite" && settings.mapStyle !== "satellite") setLastMapStyle(settings.mapStyle);
                setSettings((s) => normalizeSettings({ ...s, mapStyle: style }));
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${
                active ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Zoom / tier indicator */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-1.5 pr-3 text-xs shadow-md ring-1 ring-slate-200 backdrop-blur">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-brand">
            <TierIcon size={13} />
          </span>
          <span className="font-semibold capitalize">{tier}</span>
          <span className="text-slate-400">·</span>
          <span className="tabular-nums text-slate-500">z {zoom.toFixed(1)}</span>
        </div>

        {selectedAsset && (
          <AssetDetail
            asset={selectedAsset}
            geofences={membership.byAsset.get(selectedAsset.id) ?? []}
            onChange={(patch) => updateAsset(selectedAsset.id, patch)}
            onDelete={() => deleteAsset(selectedAsset.id)}
            onClose={() => setSelectedAssetId(null)}
            onZoomTo={() => fly({ kind: "point", center: selectedAsset.position, zoom: settings.imageFromZoom + 1 })}
          />
        )}
      </main>
    </div>
  );
}
