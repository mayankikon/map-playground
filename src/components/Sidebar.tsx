"use client";

import { useMemo, useState } from "react";
import {
  Boxes, Crosshair, Eye, EyeOff, Hexagon, Image as ImageIcon, Layers, LocateFixed, MapPin,
  PenLine, RotateCcw, Search, SlidersHorizontal, Trash2, Undo2,
} from "lucide-react";

import { ASSET_DRAG_MIME } from "./MapView";
import { AssetGlyph, DeviceCard, KeyMarker, VehicleCard, VehiclePin } from "./markers";
import { ASSET_TYPES, MAP_STYLES, TYPE_BY_ID, assetTitle } from "@/lib/catalog";
import { areaKm2 } from "@/lib/geo";
import { zoomTier, type Asset, type AssetType, type DisplaySettings, type Geofence, type LngLat, type Mode } from "@/lib/types";

export type SidebarTab = "assets" | "geofences" | "display";

interface Props {
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  assets: Asset[];
  geofences: Geofence[];
  settings: DisplaySettings;
  zoom: number;
  mode: Mode;
  draft: LngLat[];
  membership: { byAsset: Map<string, Geofence[]>; countByFence: Map<string, number> };
  selectedAssetId: string | null;
  selectedGeofenceId: string | null;
  onPickType: (typeId: string) => void;
  onSelectAsset: (id: string) => void;
  onDeleteAsset: (id: string) => void;
  onStartDraw: () => void;
  onUndoPoint: () => void;
  onFinishDraw: () => void;
  onCancelMode: () => void;
  onSelectGeofence: (id: string) => void;
  onUpdateGeofence: (id: string, patch: Partial<Geofence>) => void;
  onDeleteGeofence: (id: string) => void;
  onSettings: (patch: Partial<DisplaySettings>) => void;
  onResetDemo: () => void;
  onClearAll: () => void;
}

const TABS: { id: SidebarTab; label: string; icon: typeof Boxes }[] = [
  { id: "assets", label: "Assets", icon: Boxes },
  { id: "geofences", label: "Geofences", icon: Hexagon },
  { id: "display", label: "Display", icon: SlidersHorizontal },
];

export default function Sidebar(p: Props) {
  const nonReporting = p.assets.filter((a) => !a.reporting).length;
  return (
    <aside className="z-30 flex h-full w-[360px] shrink-0 flex-col border-r border-stroke bg-white shadow-[4px_0_24px_rgba(0,0,0,.06)]">
      <header className="flex items-center gap-3 px-5 pb-4 pt-5">
        <h1 className="min-w-0 font-(family-name:--font-saira-face) text-[20px] font-semibold italic leading-tight text-brand">Map Playground</h1>
        <div className="ml-auto text-right text-[12px] leading-tight text-ink-2">
          <div>
            <b className="text-ink">{p.assets.length}</b> assets
          </div>
          {nonReporting > 0 && <div className="text-danger">{nonReporting} non-reporting</div>}
        </div>
      </header>

      <nav className="mx-5 mb-4 grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => p.onTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-semibold transition ${
              p.tab === id ? "bg-white text-brand shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {p.tab === "assets" && <AssetsTab {...p} />}
        {p.tab === "geofences" && <GeofencesTab {...p} />}
        {p.tab === "display" && <DisplayTab {...p} />}
      </div>
    </aside>
  );
}

/* ---------------- Assets ---------------- */

function TypePreview({ type }: { type: AssetType }) {
  if (type.kind === "key") return <KeyMarker />;
  if (type.kind === "device") return <DeviceCard />;
  return (
    <div className="flex items-end gap-2">
      <VehicleCard age={type.age!} />
      <VehiclePin age={type.age!} size={40} />
    </div>
  );
}

type Filter = "all" | "new" | "mid" | "old" | "key" | "device" | "nonreporting";
const FILTERS: { id: Filter; label: string; color?: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New", color: "#00B397" },
  { id: "mid", label: "Mid", color: "#E6B117" },
  { id: "old", label: "Old", color: "#E50C0C" },
  { id: "key", label: "Keys", color: "#17A5E6" },
  { id: "device", label: "Exceptions", color: "#666666" },
  { id: "nonreporting", label: "Non-reporting", color: "#B10F2E" },
];

function matchesFilter(a: Asset, f: Filter) {
  const t = TYPE_BY_ID[a.typeId];
  if (f === "all") return true;
  if (f === "nonreporting") return !a.reporting;
  if (f === "key" || f === "device") return t?.kind === f;
  return t?.kind === "vehicle" && t.age === f;
}

function assetSubtitle(a: Asset) {
  const kind = TYPE_BY_ID[a.typeId]?.kind;
  if (kind === "vehicle") return `${a.stock ?? "—"} • ${a.condition ?? ""}`;
  if (kind === "key") return a.address || "No address";
  return a.reporting ? "Location up to date" : "Not reporting";
}

function AssetsTab(p: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const placing = p.mode.kind === "place" ? p.mode.typeId : null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return p.assets
      .filter((a) => matchesFilter(a, filter))
      .filter((a) => !needle || [assetTitle(a), a.vin, a.stock, a.code].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => assetTitle(a).localeCompare(assetTitle(b), undefined, { numeric: true }));
  }, [p.assets, q, filter]);

  return (
    <>
      <SectionTitle title="Add to map" hint="Click to place, or drag onto the map" />
      <div className="grid grid-cols-2 gap-2.5">
        {ASSET_TYPES.map((t) => {
          const active = placing === t.id;
          const count = p.assets.filter((a) => a.typeId === t.id).length;
          return (
            <button
              key={t.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(ASSET_DRAG_MIME, t.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => p.onPickType(t.id)}
              className={`group overflow-hidden rounded-xl border text-left transition ${
                active ? "border-brand ring-2 ring-brand/20" : "border-stroke hover:border-[#99a3ad] hover:shadow-sm"
              } ${t.kind === "device" ? "col-span-2" : ""}`}
            >
              <div className="relative grid h-[84px] place-items-center bg-canvas">
                <div className="pointer-events-none">
                  <TypePreview type={t} />
                </div>
                {active && (
                  <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-md bg-brand py-1 text-[11px] font-semibold text-white">
                    <Crosshair size={12} /> Placing…
                  </span>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-white/90 px-1.5 text-[11px] font-semibold tabular-nums text-ink-2">{count}</span>
              </div>
              <div className="px-2.5 py-2">
                <div className="text-[14px] font-semibold leading-tight">{t.name}</div>
                <div className="text-[12px] text-ink-2">{t.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <SectionTitle title={`On the map (${p.assets.length})`} />
        <label className="flex items-center gap-2 rounded-lg border border-stroke px-2.5 py-1.5 focus-within:border-brand">
          <Search size={14} className="text-[#99a3ad]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search model, VIN, stock, key or device ID"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#99a3ad]"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(filter === f.id ? "all" : f.id)}>
              {f.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.color }} />}
              {f.label}
            </Chip>
          ))}
        </div>

        <ul className="mt-3 divide-y divide-[#eee]">
          {filtered.slice(0, 300).map((a) => {
            const fences = p.membership.byAsset.get(a.id) ?? [];
            const selected = a.id === p.selectedAssetId;
            return (
              <li key={a.id}>
                <div
                  onClick={() => p.onSelectAsset(a.id)}
                  className={`group -mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${selected ? "bg-brand-50" : "hover:bg-[#f5f5f5]"}`}
                >
                  <AssetGlyph asset={a} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      <span className="truncate">{assetTitle(a)}</span>
                      {!a.reporting && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title="Not reporting" />}
                    </div>
                    <div className="truncate text-[12px] text-ink-2">
                      {assetSubtitle(a)}
                      {fences.length > 0 && <> · <span className="text-[#0B6494]">{fences.map((f) => f.name).join(", ")}</span></>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onDeleteAsset(a.id);
                    }}
                    className="rounded-md p-1.5 text-[#99a3ad] opacity-0 hover:bg-red-50 hover:text-danger group-hover:opacity-100"
                    aria-label={`Delete ${assetTitle(a)}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="py-6 text-center text-sm text-[#99a3ad]">No assets match.</li>}
        </ul>
      </div>
    </>
  );
}

/* ---------------- Geofences ---------------- */

function GeofencesTab(p: Props) {
  const drawing = p.mode.kind === "draw";

  return (
    <>
      {drawing ? (
        <div className="rounded-xl border border-[#0B6494]/30 bg-[#0B6494]/[0.06] p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0B6494]">
            <PenLine size={15} /> Drawing geofence
          </div>
          <ol className="mt-2 space-y-1 text-[12px] text-ink-2">
            <li>1. Click the map to plot each corner.</li>
            <li>2. Click the first point, double-click, or press Enter to close.</li>
            <li>3. Backspace removes the last point, Esc cancels.</li>
          </ol>
          <div className="mt-3 text-[12px] font-semibold text-ink">
            {p.draft.length} point{p.draft.length === 1 ? "" : "s"} plotted
            {p.draft.length >= 3 && <span className="font-normal text-ink-2"> · {areaKm2(p.draft).toFixed(3)} km²</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={p.onUndoPoint} disabled={!p.draft.length} className="btn-secondary flex-1">
              <Undo2 size={14} /> Undo
            </button>
            <button onClick={p.onCancelMode} className="btn-secondary flex-1">Cancel</button>
            <button onClick={p.onFinishDraw} disabled={p.draft.length < 3} className="btn-primary flex-1">Finish</button>
          </div>
        </div>
      ) : (
        <button onClick={p.onStartDraw} className="btn-primary w-full py-2.5">
          <PenLine size={15} /> Draw geofence
        </button>
      )}

      <div className="mt-6">
        <SectionTitle title={`Geofences (${p.geofences.length})`} />
        {p.geofences.length === 0 && (
          <p className="rounded-lg border border-dashed border-stroke py-8 text-center text-sm text-[#99a3ad]">
            No geofences yet. Draw one by plotting points on the map.
          </p>
        )}
        <ul className="space-y-2">
          {p.geofences.map((g) => {
            const selected = g.id === p.selectedGeofenceId;
            const count = p.membership.countByFence.get(g.id) ?? 0;
            const inside = selected ? p.assets.filter((a) => p.membership.byAsset.get(a.id)?.some((f) => f.id === g.id)) : [];
            return (
              <li key={g.id} className={`rounded-xl border transition ${selected ? "border-[#99a3ad] bg-[#fafafa] shadow-sm" : "border-stroke"}`}>
                <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => p.onSelectGeofence(g.id)}>
                  <span className="h-8 w-8 shrink-0 rounded-md border-2 border-white bg-[#0B6494]/30 shadow-[0_0_0_1px_#dcdcdc]" />
                  <div className="min-w-0 flex-1">
                    {selected ? (
                      <input
                        value={g.name}
                        onChange={(e) => p.onUpdateGeofence(g.id, { name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="-mx-1 w-full rounded border border-transparent bg-transparent px-1 text-[14px] font-semibold outline-none hover:border-stroke focus:border-brand focus:bg-white"
                      />
                    ) : (
                      <div className="truncate text-[14px] font-semibold">{g.name}</div>
                    )}
                    <div className="text-[12px] text-ink-2">
                      {count} asset{count === 1 ? "" : "s"} inside · {g.points.length} pts
                    </div>
                  </div>
                  <IconBtn label={g.visible ? "Hide" : "Show"} onClick={() => p.onUpdateGeofence(g.id, { visible: !g.visible })}>
                    {g.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </IconBtn>
                  <IconBtn label="Delete" danger onClick={() => p.onDeleteGeofence(g.id)}>
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
                {selected && (
                  <div className="space-y-2 border-t border-stroke px-3 py-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[1px] text-[#99a3ad]">Lot address</span>
                      <input
                        value={g.address}
                        placeholder="e.g. 1101 W State Hwy 114, Grapevine, TX 76051"
                        onChange={(e) => p.onUpdateGeofence(g.id, { address: e.target.value })}
                        className="field"
                      />
                    </label>
                    {inside.length === 0 ? (
                      <p className="py-1 text-[12px] text-[#99a3ad]">No assets inside this geofence.</p>
                    ) : (
                      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                        {inside.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => p.onSelectAsset(a.id)}
                            className="flex items-center gap-1 rounded-full border border-stroke bg-white py-0.5 pl-0.5 pr-2 text-[12px] font-medium hover:border-[#99a3ad]"
                          >
                            <AssetGlyph asset={a} size={18} />
                            <span className="max-w-[140px] truncate">{assetTitle(a)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/* ---------------- Display ---------------- */

const MAX_Z = 22;

function DisplayTab(p: Props) {
  const { clusterBelowZoom: c, imageFromZoom: img } = p.settings;
  const tier = zoomTier(p.zoom, p.settings);
  const pct = (z: number) => `${(Math.min(MAX_Z, Math.max(0, z)) / MAX_Z) * 100}%`;

  const setCluster = (v: number) => {
    const cluster = Math.round(v);
    p.onSettings({ clusterBelowZoom: cluster, imageFromZoom: Math.max(img, cluster) });
  };
  const setImage = (v: number) => {
    const image = Math.round(v * 2) / 2;
    p.onSettings({ imageFromZoom: image, clusterBelowZoom: Math.min(c, Math.floor(image)) });
  };

  return (
    <>
      <SectionTitle title="Marker style by zoom" hint="Dense groups cluster, isolated vehicles show as markers, close up → images" />

      <div className="rounded-xl border border-stroke p-4">
        <div className="relative h-9">
          <div className="absolute inset-y-0 left-0 flex items-center justify-center rounded-l-md bg-brand-50 text-[11px] font-semibold text-brand" style={{ width: pct(c) }}>
            {c >= 4 && "Clusters + isolated markers"}
          </div>
          <div className="absolute inset-y-0 flex items-center justify-center bg-[#fbefc9] text-[11px] font-semibold text-[#8a6a06]" style={{ left: pct(c), width: `calc(${pct(img)} - ${pct(c)})` }}>
            {img - c >= 3 && "Markers"}
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-md bg-[#d9e8f1] text-[11px] font-semibold text-[#0B6494]" style={{ left: pct(img) }}>
            {MAX_Z - img >= 3 && "Images"}
          </div>
          <div className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded bg-ink transition-[left]" style={{ left: pct(p.zoom) }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1 text-[10px] font-semibold tabular-nums text-white">
              {p.zoom.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-[#99a3ad]">
          <span>0</span><span>5</span><span>10</span><span>15</span><span>22</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-2">
          Now showing
          <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 font-semibold capitalize text-ink">
            {tier === "clusters" ? <Layers size={12} /> : tier === "markers" ? <MapPin size={12} /> : <ImageIcon size={12} />}
            {tier}
          </span>
        </div>
      </div>

      <ZoomSlider
        icon={<Layers size={14} className="text-brand" />}
        label="Cluster dense groups until zoom"
        value={c}
        min={1}
        max={21}
        step={1}
        onChange={setCluster}
        onUseCurrent={() => setCluster(Math.max(1, Math.round(p.zoom)))}
      />
      <ZoomSlider
        icon={<ImageIcon size={14} className="text-[#0B6494]" />}
        label="Image markers from zoom"
        value={img}
        min={2}
        max={21}
        step={0.5}
        onChange={setImage}
        onUseCurrent={() => setImage(Math.max(2, p.zoom))}
      />

      <div className="mt-6">
        <SectionTitle title="Cluster density" hint="Vehicles this close together (and at least this many) stay a number until the cluster zoom; the rest show individually" />
        <ZoomSlider
          icon={<Layers size={14} className="text-brand" />}
          label="Grouping distance"
          unit="meters"
          value={p.settings.groupDistance}
          min={10}
          max={200}
          step={5}
          onChange={(v) => p.onSettings({ groupDistance: Math.round(v) })}
        />
        <ZoomSlider
          icon={<Layers size={14} className="text-brand" />}
          label="Min vehicles per cluster"
          value={p.settings.clusterMinPoints}
          min={2}
          max={10}
          step={1}
          onChange={(v) => p.onSettings({ clusterMinPoints: Math.round(v) })}
        />
      </div>

      <div className="mt-6">
        <SectionTitle title="Map style" />
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-canvas p-1">
          {MAP_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => p.onSettings({ mapStyle: s.id })}
              className={`rounded-md py-1.5 text-[12px] font-semibold ${p.settings.mapStyle === s.id ? "bg-white text-brand shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SectionTitle title="Data" hint="Saved automatically in this browser" />
        <div className="flex gap-2">
          <button onClick={p.onResetDemo} className="btn-secondary flex-1">
            <RotateCcw size={14} /> Reset demo
          </button>
          <button
            onClick={() => {
              if (confirm("Remove all assets and geofences?")) p.onClearAll();
            }}
            className="btn-secondary flex-1 hover:!border-red-200 hover:!text-danger"
          >
            <Trash2 size={14} /> Clear all
          </button>
        </div>
      </div>
    </>
  );
}

function ZoomSlider(props: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onUseCurrent?: () => void;
  unit?: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-[14px]">
        {props.icon}
        <span className="flex-1 font-semibold">{props.label}</span>
        <input
          type="number"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) props.onChange(Math.min(props.max, Math.max(props.min, v)));
          }}
          className="w-14 rounded-md border border-stroke px-1.5 py-0.5 text-right text-sm tabular-nums outline-none focus:border-brand"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onChange={(e) => props.onChange(parseFloat(e.target.value))}
          className="flex-1 accent-[#126550]"
        />
        {props.onUseCurrent && (
        <button
          onClick={props.onUseCurrent}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-brand hover:bg-brand-50"
          title="Set to the map's current zoom"
        >
          <LocateFixed size={12} /> Current
        </button>
        )}
        {props.unit && <span className="w-[52px] text-[12px] text-ink-2">{props.unit}</span>}
      </div>
    </div>
  );
}

/* ---------------- Bits ---------------- */

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2.5">
      <h2 className="text-[12px] font-bold uppercase tracking-[1.2px] text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-[12px] text-ink-2">{hint}</p>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold ${
        active ? "border-brand bg-brand text-white" : "border-stroke text-ink-2 hover:border-[#99a3ad]"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-md p-1.5 text-[#99a3ad] ${danger ? "hover:bg-red-50 hover:text-danger" : "hover:bg-canvas hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
