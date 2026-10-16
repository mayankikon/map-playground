/* eslint-disable @next/next/no-img-element -- Figma-exported icons are plain images */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, CircleHelp } from "lucide-react";

import { AssetGlyph } from "./markers";
import { FIGMA, STOCK_COLOR, TYPE_BY_ID, assetTitle, fmtMiles, fmtMoney } from "@/lib/catalog";
import { STOCK_TYPES, type AppVersion, type Asset, type AssetView, type Condition, type Geofence, type InventoryAge } from "@/lib/types";

/*
 * Toolbox app shell from Figma "Inventory Management" → Satellite View
 * (node 11918:319177). Icons are the frame's exported assets in /figma/app.
 */

const A = (name: string) => `/figma/app/${name}`;

/** Recolors a single-color exported icon while keeping its exact glyph. */
function MaskIcon({ src, color, size = 24 }: { src: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: size, height: size, backgroundColor: color, mask: `url(${src}) center / contain no-repeat`, WebkitMask: `url(${src}) center / contain no-repeat` }}
    />
  );
}

/* ---------------- Left navigation ---------------- */

const NAV: { label: string; icon: string }[] = [
  { label: "Inventory", icon: "nav-inventory.svg" },
  { label: "Dashboard", icon: "nav-inventory.svg" },
  { label: "Customers", icon: "nav-customers.svg" },
  { label: "Billing", icon: "nav-billing.svg" },
  { label: "Reports", icon: "nav-reports.svg" },
  { label: "Staff", icon: "nav-staff.svg" },
  { label: "Settings", icon: "nav-settings.svg" },
];

export function NavRail({ version, onVersion }: { version: AppVersion; onVersion: (v: AppVersion) => void }) {
  return (
    <nav aria-label="Main" className="flex h-full w-[248px] shrink-0 flex-col items-center gap-4 border-r border-[#126550] bg-[#1a9375] py-6 text-white">
      <div className="w-full pl-4 pr-5">
        <img alt="Toolbox Lot Management" src={A("toolbox-logo.svg")} className="h-10 w-20" />
      </div>

      <button type="button" className="flex h-16 w-[232px] items-center gap-2 rounded-[6px] bg-[rgba(24,27,30,0.15)] py-2 pl-2 pr-3 text-left hover:bg-[rgba(24,27,30,0.22)]">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-[6px] border border-[#dcdcdc] bg-white">
          <img alt="" src={A("account-logo.png")} className="absolute left-[2.78%] top-[40.67%] h-[18.67%] w-[94.44%] max-w-none" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-[19px]">Lexus of Santa Fe</span>
          <span className="block text-[12px] leading-4 opacity-75">Ikon NADA Group</span>
        </span>
        <img alt="" src={A("account-chevron.svg")} className="h-[18px] w-2" />
      </button>

      <ul className="flex w-full flex-1 flex-col">
        {NAV.map(({ label, icon }) => {
          const active = label === "Inventory";
          return (
            <li key={label} className="w-full py-1 pl-2 pr-6">
              <a
                href="#"
                aria-current={active ? "page" : undefined}
                onClick={(e) => e.preventDefault()}
                className={`flex items-center gap-3 rounded-[8px] px-4 py-2 text-[14px] font-semibold leading-[19px] ${active ? "bg-[rgba(24,27,30,0.15)]" : "hover:bg-[rgba(24,27,30,0.08)]"}`}
              >
                <img alt="" src={A(icon)} className="size-4" />
                {label}
              </a>
            </li>
          );
        })}
      </ul>

      <VersionSelect version={version} onVersion={onVersion} />

      <p className="text-center text-[12px] leading-4">
        © 2026 VBI Group, Inc.
        <br />
        All rights reserved.
      </p>
    </nav>
  );
}

const VERSIONS: { id: AppVersion; label: string }[] = [
  { id: "v0", label: "V0" },
  { id: "v1", label: "V1" },
  { id: "v2", label: "V2" },
];

/** Prototype version switch, bottom of the nav rail; the menu opens upward. */
function VersionSelect({ version, onVersion }: { version: AppVersion; onVersion: (v: AppVersion) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = VERSIONS.find((v) => v.id === version) ?? VERSIONS[VERSIONS.length - 1];
  return (
    <div ref={ref} className="relative mx-2 mb-3" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      {open && (
        <ul role="listbox" aria-label="Prototype version" className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 overflow-hidden rounded-[6px] bg-white py-1 text-[#111] shadow-[0_8px_24px_rgba(0,0,0,.28)] animate-[pop-in_120ms_ease-out]">
          {VERSIONS.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                role="option"
                aria-selected={v.id === version}
                onClick={() => {
                  onVersion(v.id);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[#f4f4f4]"
              >
                <span className="mt-0.5 w-4 shrink-0">{v.id === version && <Check size={14} className="text-[#1a9375]" />}</span>
                <span className="text-[14px] font-semibold">{v.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-[6px] border border-white/30 bg-white/10 px-3 py-1.5 text-[14px] hover:bg-white/20"
      >
        <span>
          Version <span className="font-semibold">{current.label}</span>
        </span>
        <ChevronUp size={16} className={`transition-transform ${open ? "" : "rotate-180"}`} />
      </button>
    </div>
  );
}

/* ---------------- Top bar ---------------- */

export function TopBar({ search }: { search: React.ReactNode }) {
  return (
    <header className="relative z-50 flex h-[54px] shrink-0 gap-px bg-[#dcdcdc]">
      <div className="flex flex-1 items-center border-b border-[#dcdcdc] bg-white py-[7px] pl-8 pr-4">
        {search}
        <div className="flex flex-1 items-center justify-end gap-6">
          <button type="button" aria-label="Help" className="text-[#666] hover:text-[#111]">
            <CircleHelp size={24} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <button type="button" className="flex h-[54px] items-center justify-end gap-2 border-b border-[#dcdcdc] bg-[#f4f4f4] py-[17px] pl-4 pr-8 hover:bg-[#ececec]">
        <span className="text-[16px] font-semibold leading-[22px] text-[#111]">Mallory P.</span>
        <img alt="" src={A("user-chevron-down.svg")} className="size-6" />
      </button>
    </header>
  );
}

/* ---------------- Vehicle list panel ---------------- */

/** Deterministic stand-in battery level until devices report one. */
export function batteryLow(a: Asset) {
  let h = 0;
  for (const c of a.id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return !a.reporting || Math.abs(h) % 9 === 0;
}

function ListRow({ asset, selected, onClick }: { asset: Asset; selected: boolean; onClick: () => void }) {
  const kind = TYPE_BY_ID[asset.typeId]?.kind;
  const low = batteryLow(asset);
  return (
    <li style={{ contentVisibility: "auto", containIntrinsicSize: "auto 104px" }}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`flex w-full flex-col px-4 text-left ${selected ? "bg-[#f4f4f4]" : "bg-white hover:bg-[#f9f9f9]"}`}
      >
        <span className="flex w-full items-center gap-3 py-4">
          {kind === "vehicle" ? (
            <span className="relative h-[72px] w-[95px] shrink-0 overflow-hidden rounded-[4px] bg-[#eef0f2]">
              {asset.noImage ? (
                <img alt="" src={FIGMA.carPlaceholder} className="absolute inset-0 size-full object-contain p-2 opacity-70" />
              ) : (
                <img alt="" src={asset.image ?? A("list-car.png")} className="absolute inset-0 size-full object-cover" />
              )}
              {asset.condition === "New" && (
                <span className="absolute left-1 top-1 flex rounded-[4px] bg-[#e6b117] px-1.5 pb-1 pt-[3px]">
                  <img alt="Featured" src={A("star-filled.svg")} className="size-2" />
                </span>
              )}
            </span>
          ) : (
            <span className="grid h-[72px] w-[95px] shrink-0 place-items-center rounded-[4px] bg-[#f4f4f4]">
              <AssetGlyph asset={asset} size={44} />
            </span>
          )}

          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[18px] font-semibold text-[#111]">{assetTitle(asset)}</span>
            {kind === "vehicle" ? (
              <>
                <span className="truncate text-[16px] text-[#666]">
                  {asset.vin} • {asset.stock}
                </span>
                <span className="truncate text-[16px] text-[#666]">
                  <span style={{ color: asset.condition && asset.condition !== "New" ? STOCK_COLOR[asset.condition] : undefined }}>{asset.condition}</span> • {fmtMoney(asset.price)} • {fmtMiles(asset.miles)}
                </span>
              </>
            ) : (
              <span className="truncate text-[16px] text-[#666]">{asset.address || (asset.reporting ? "Location up to date" : "Not reporting")}</span>
            )}
          </span>

          <span className="flex shrink-0 flex-col items-center justify-center gap-3">
            <img alt="Location" src={A("list-location.svg")} className="size-4" />
            {kind !== "device" && <img alt="Key paired" src={A("list-key.svg")} className="size-4" />}
            <span title={low ? "Battery low" : "Battery full"}>
              {low ? <MaskIcon src={A("list-battery-full.svg")} color="#E50C0C" size={16} /> : <img alt="Battery full" src={A("list-battery-full.svg")} className="size-4" />}
            </span>
          </span>
        </span>
        <span className="h-px w-full bg-[#dcdcdc]" />
      </button>
    </li>
  );
}

export type ListTab = "vehicles" | "keys";

export function VehicleListPanel({
  assets,
  view,
  selectedId,
  onSelect,
  onCollapse,
  full,
  tab,
  onTab,
  keysContent,
}: {
  assets: Asset[];
  view: AssetView;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCollapse?: () => void;
  /** List view: fills the map area instead of the 400px side panel. */
  full?: boolean;
  tab: ListTab;
  onTab: (t: ListTab) => void;
  /** Rendered instead of the vehicle list when the Keys tab is active. */
  keysContent?: React.ReactNode;
}) {
  const noun = view === "all" ? (assets.length === 1 ? "asset" : "assets") : assets.length === 1 ? "vehicle" : "vehicles";
  const shown = assets.slice(0, 600);
  return (
    <section aria-label="Results" className={`flex h-full flex-col bg-white ${full ? "w-full" : "w-[432px] shrink-0 border-r border-[#dcdcdc]"}`}>
      <div className="flex h-[52px] shrink-0 items-stretch">
        <div role="tablist" aria-label="List" className="flex flex-1">
          {(["vehicles", "keys"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTab(t)}
              className={`flex-1 border-b text-[15px] font-semibold uppercase tracking-[1.5px] transition-colors ${
                tab === t ? "border-b-[3px] border-[#1a9375] text-[#1a9375]" : "border-[#dcdcdc] text-[#555] hover:text-[#111]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="Collapse list" className="grid w-12 place-items-center border-b border-[#dcdcdc] hover:bg-[#f4f4f4]">
            <img alt="" src={A("panel-collapse.svg")} className="size-6" />
          </button>
        )}
      </div>

      {tab === "keys" && keysContent ? (
        keysContent
      ) : (
        <>
          <p className="shrink-0 px-4 pb-1 pt-3 text-[16px] text-[#666]">
            Showing {assets.length.toLocaleString("en-US")} {noun}
          </p>
          <ul className={`min-h-0 flex-1 overflow-y-auto ${full ? "grid grid-cols-2 content-start gap-x-4" : ""}`}>
            {shown.map((a) => (
              <ListRow key={a.id} asset={a} selected={a.id === selectedId} onClick={() => onSelect(a.id)} />
            ))}
            {assets.length === 0 && <li className="px-4 py-10 text-center text-[16px] text-[#8f8f8f]">No results match these filters.</li>}
            {assets.length > shown.length && <li className="px-4 py-4 text-center text-[14px] text-[#8f8f8f]">Showing the first {shown.length}. Refine filters to see more.</li>}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------------- Map filter bar ---------------- */

export interface Filters {
  stock: Condition[];
  age: InventoryAge[];
  battery: ("full" | "low")[];
  nonReportingOnly: boolean;
}

export const EMPTY_FILTERS: Filters = { stock: [], age: [], battery: [], nonReportingOnly: false };

export function applyFilters(assets: Asset[], f: Filters, query: string) {
  const q = query.trim().toLowerCase();
  return assets.filter((a) => {
    const t = TYPE_BY_ID[a.typeId];
    if (t?.kind === "vehicle") {
      if (f.stock.length && !f.stock.includes(a.condition ?? "Preowned")) return false;
      if (f.age.length && !f.age.includes(t.age ?? "new")) return false;
    }
    if (f.battery.length && !f.battery.includes(batteryLow(a) ? "low" : "full")) return false;
    if (f.nonReportingOnly && a.reporting) return false;
    if (q && ![assetTitle(a), a.vin, a.stock, a.code, a.address].some((s) => s?.toLowerCase().includes(q))) return false;
    return true;
  });
}

function useOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOutside]);
  return ref;
}

function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  open,
  onOpen,
}: {
  label: string;
  options: { value: T; label: string; swatch?: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const active = value.length > 0;
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className={`flex items-center gap-4 rounded-[4px] border bg-white px-2 py-1.5 text-[16px] leading-[22px] ${active ? "border-[#1a9375] text-[#111]" : "border-[#dcdcdc] text-[#666]"} hover:border-[#99a3ad]`}
      >
        <span className="whitespace-nowrap">
          {label}
          {active && <span className="ml-1.5 rounded-full bg-[#1a9375] px-1.5 text-[12px] font-semibold text-white">{value.length}</span>}
        </span>
        <img alt="" src={A("dropdown-chevron.svg")} className={`size-6 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable className="absolute left-0 top-[calc(100%+4px)] z-40 min-w-full overflow-hidden rounded-[4px] border border-[#dcdcdc] bg-white py-1 shadow-[0_6px_16px_rgba(0,0,0,.14)]">
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                className="flex w-full items-center gap-2.5 whitespace-nowrap px-3 py-2 text-left text-[16px] text-[#111] hover:bg-[#f4f4f4]"
              >
                <span className={`grid size-4 place-items-center rounded-[3px] border ${on ? "border-[#1a9375] bg-[#1a9375] text-white" : "border-[#99a3ad]"}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                {o.swatch && <span className="size-2.5 rounded-full" style={{ background: o.swatch }} />}
                {o.label}
              </button>
            );
          })}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full border-t border-[#eee] px-3 py-2 text-left text-[14px] text-[#007cbe] hover:bg-[#f4f4f4]">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  onFilters,
  mode,
  onMode,
}: {
  filters: Filters;
  onFilters: (f: Filters) => void;
  mode: "map" | "list";
  onMode: (m: "map" | "list") => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useOutside(() => setOpen(null));
  const count = filters.stock.length + filters.age.length + filters.battery.length + (filters.nonReportingOnly ? 1 : 0);
  const set = (k: string) => (o: boolean) => setOpen(o ? k : null);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 py-4 pl-4 pr-4">
      <div className="pointer-events-auto flex flex-1 flex-wrap items-start gap-2">
        <div className="relative">
          <button
            type="button"
            aria-label="More filters"
            aria-expanded={open === "more"}
            onClick={() => set("more")(open !== "more")}
            className={`relative flex rounded-[4px] border bg-white p-2 hover:border-[#99a3ad] ${count ? "border-[#1a9375]" : "border-[#dcdcdc]"}`}
          >
            <img alt="" src={A("filter-adjust.svg")} className="size-6" />
            {count > 0 && <span className="absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full bg-[#1a9375] text-[11px] font-bold text-white">{count}</span>}
          </button>
          {open === "more" && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-[240px] rounded-[4px] border border-[#dcdcdc] bg-white p-3 shadow-[0_6px_16px_rgba(0,0,0,.14)]">
              <label className="flex cursor-pointer items-center gap-2.5 text-[16px] text-[#111]">
                <input type="checkbox" checked={filters.nonReportingOnly} onChange={(e) => onFilters({ ...filters, nonReportingOnly: e.target.checked })} className="size-4 accent-[#1a9375]" />
                Non-reporting only
              </label>
              <button type="button" disabled={!count} onClick={() => onFilters(EMPTY_FILTERS)} className="mt-3 w-full rounded-[4px] border border-[#dcdcdc] py-1.5 text-[14px] font-semibold text-[#007cbe] hover:bg-[#f4f4f4] disabled:text-[#c4c4c4]">
                Clear all filters
              </button>
            </div>
          )}
        </div>
        <Dropdown
          label="Stock Type"
          options={STOCK_TYPES.map((t) => ({ value: t, label: t }))}
          value={filters.stock}
          onChange={(stock) => onFilters({ ...filters, stock })}
          open={open === "stock"}
          onOpen={set("stock")}
        />
        <Dropdown
          label="Inventory Age"
          options={[
            { value: "new", label: "0 - 45 days", swatch: "#00B397" },
            { value: "mid", label: "46 - 90 days", swatch: "#E6B117" },
            { value: "old", label: "90+ days", swatch: "#E50C0C" },
          ]}
          value={filters.age}
          onChange={(age) => onFilters({ ...filters, age })}
          open={open === "age"}
          onOpen={set("age")}
        />
        <Dropdown
          label="Battery Level"
          options={[
            { value: "full", label: "Good" },
            { value: "low", label: "Low" },
          ]}
          value={filters.battery}
          onChange={(battery) => onFilters({ ...filters, battery })}
          open={open === "battery"}
          onOpen={set("battery")}
        />
      </div>

      {/* Map / list view toggle */}
      <div role="radiogroup" aria-label="View" className="pointer-events-auto flex rounded-[4px] border border-[#cbcbcb] bg-[#f4f4f4] p-0.5">
        <button type="button" role="radio" aria-checked={mode === "map"} aria-label="Map view" onClick={() => onMode("map")} className={`rounded-[3px] px-3 py-1.5 ${mode === "map" ? "bg-white" : ""}`}>
          {mode === "map" ? <img alt="" src={A("view-map.svg")} className="size-6" /> : <MaskIcon src={A("view-map.svg")} color="#666" />}
        </button>
        <button type="button" role="radio" aria-checked={mode === "list"} aria-label="List view" onClick={() => onMode("list")} className={`rounded-[3px] px-3 py-1.5 ${mode === "list" ? "bg-white" : ""}`}>
          <span className="relative block size-6 overflow-clip" aria-hidden>
            <span className={`absolute inset-[4.17%_4.17%_54.17%_4.17%] rounded-[2px] border-2 ${mode === "list" ? "border-[#1a9375]" : "border-[#666]"}`} />
            <span className={`absolute inset-[54.17%_4.17%_4.17%_4.17%] rounded-[2px] border-2 ${mode === "list" ? "border-[#1a9375]" : "border-[#666]"}`} />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- Right-hand map controls ---------------- */

export function AssetTypeToggle({ view, onView }: { view: AssetView; onView: (v: AssetView) => void }) {
  const car = view !== "keys";
  const key = view !== "vehicles";
  return (
    <div role="radiogroup" aria-label="Asset type" className="flex h-[92px] w-12 flex-col rounded-[4px] border border-[#cbcbcb] bg-[#f4f4f4] p-0.5">
      <button type="button" role="radio" aria-checked={car} aria-label="Vehicles" onClick={() => onView("vehicles")} className={`grid flex-1 place-items-center rounded-[3px] ${car ? "bg-white" : "hover:bg-white/60"}`}>
        <MaskIcon src={A("toggle-car.svg")} color={car ? "#1A9375" : "#666666"} />
      </button>
      <button type="button" role="radio" aria-checked={key} aria-label="Keys" onClick={() => onView("keys")} className={`grid flex-1 place-items-center rounded-[3px] ${key ? "bg-white" : "hover:bg-white/60"}`}>
        <MaskIcon src={A("toggle-key.svg")} color={key ? "#1A9375" : "#666666"} />
      </button>
    </div>
  );
}

export function MapBar({ satellite, onLayers, onZoomIn, onZoomOut, onNorth, bearing }: { satellite: boolean; onLayers: () => void; onZoomIn: () => void; onZoomOut: () => void; onNorth: () => void; bearing: number }) {
  return (
    <div className="flex w-12 flex-col items-start gap-4">
      <button type="button" onClick={onLayers} aria-label={satellite ? "Switch to map" : "Switch to satellite"} className="relative size-[46px] overflow-hidden rounded-[3px] border border-[#dcdcdc] shadow-[0_1px_3px_rgba(0,0,0,.2)] hover:border-white">
        <img alt="" src={A("layers-thumb.png")} className={`absolute inset-0 size-full object-cover ${satellite ? "" : "saturate-150"}`} />
        <span className="absolute inset-0 bg-gradient-to-b from-transparent from-50% via-[rgba(0,0,0,0.3)] via-75% to-[rgba(0,0,0,0.5)]" />
        <span className="absolute inset-x-0 bottom-[5px] text-center text-[10px] font-semibold text-white [text-shadow:0_4px_4px_rgba(0,0,0,.25)]">Layers</span>
      </button>
      <div className="flex h-[88px] w-12 flex-col items-center justify-center gap-6 overflow-clip rounded-[4px] border border-[#dcdcdc] bg-white px-1 py-2 shadow-[0_1px_3px_rgba(0,0,0,.2)]">
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" className="rounded hover:bg-[#f4f4f4]">
          <img alt="" src={A("zoom-in.svg")} className="size-6" />
        </button>
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" className="rounded hover:bg-[#f4f4f4]">
          <img alt="" src={A("zoom-out.svg")} className="size-6" />
        </button>
      </div>
      <button type="button" onClick={onNorth} aria-label="Reset north" className="grid h-10 w-12 place-items-center overflow-clip rounded-[4px] border border-[#dcdcdc] bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] hover:bg-[#f9f9f9]">
        <img alt="" src={A("compass.svg")} className="size-6 transition-transform" style={{ transform: `rotate(${-bearing}deg)` }} />
      </button>
    </div>
  );
}

export function GeofenceSelect({ geofences, selectedId, onSelect }: { geofences: Geofence[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  const current = geofences.find((g) => g.id === selectedId);
  return (
    <div ref={ref} className="relative">
      {open && (
        <div role="listbox" className="absolute bottom-[calc(100%+4px)] right-0 z-40 max-h-[280px] w-full min-w-[240px] overflow-y-auto rounded-[4px] border border-[#dcdcdc] bg-white py-1 shadow-[0_-6px_16px_rgba(0,0,0,.14)]">
          {geofences.map((g) => (
            <button
              key={g.id}
              type="button"
              role="option"
              aria-selected={g.id === selectedId}
              onClick={() => {
                onSelect(g.id);
                setOpen(false);
              }}
              className={`flex w-full flex-col px-3 py-2 text-left hover:bg-[#f4f4f4] ${g.id === selectedId ? "bg-[#e7f4ef]" : ""}`}
            >
              <span className="truncate text-[16px] text-[#111]">{g.name}</span>
              {g.address && <span className="truncate text-[12px] text-[#666]">{g.address}</span>}
            </button>
          ))}
          {geofences.length === 0 && <p className="px-3 py-2 text-[14px] text-[#8f8f8f]">No geofences yet.</p>}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-4 rounded-[4px] border border-[#dcdcdc] bg-white px-2 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,.12)] hover:border-[#99a3ad]"
      >
        <span className="flex items-center gap-2">
          <img alt="" src={A("boundary-custom.svg")} className="size-6" />
          <span className="max-w-[170px] truncate text-[16px] font-semibold leading-[22px] text-[#111]">{current?.name ?? "Select Geofence"}</span>
        </span>
        <img alt="" src={A("chevron-up.svg")} className={`size-6 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}

const LEGEND = {
  age: { caption: "Showing indicators by inventory age", items: [["legend-new.svg", "0 - 45"], ["legend-mid.svg", "46 - 90"], ["legend-old.svg", "90+"]] },
  parked: { caption: "Showing indicators by days parked", items: [["legend-new.svg", "0 - 7"], ["legend-mid.svg", "8 - 30"], ["legend-old.svg", "30+"]] },
} as const;

export function Legend() {
  const [tab, setTab] = useState<"age" | "parked">("age");
  const l = LEGEND[tab];
  return (
    <div className="flex h-[145px] flex-col items-center justify-center gap-4 rounded-[4px] border border-[#dcdcdc] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,.12)]">
      <div role="tablist" className="flex items-center rounded-[4px] bg-[#f4f4f4] px-0.5 py-px drop-shadow-[0_1px_0.5px_rgba(0,0,0,0.08)]">
        {(
          [
            ["age", "Inventory Age"],
            ["parked", "Days Parked"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex h-6 w-[116px] items-center justify-center rounded-[4px] pb-[5px] pl-3 pr-2 pt-1 text-[12px] font-semibold leading-4 ${tab === k ? "bg-[#126550] text-white" : "text-[#8f8f8f] hover:text-[#666]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-8">
        {l.items.map(([shape, label]) => (
          <div key={label} className="relative flex size-12 flex-col items-center justify-end gap-1">
            <span className="absolute inset-[16.67%]">
              <img alt="" src={A(shape)} className="absolute inset-[-6.25%_-6.25%_-4.01%_-6.25%] block size-[112.5%] max-w-none" />
            </span>
            <img alt="" src={A("legend-aging.svg")} className="absolute inset-[22.92%_29.17%_35.42%_29.17%] size-5" />
            <span className="relative translate-y-5 whitespace-nowrap text-[11px] leading-4 text-black">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[#111]">{l.caption}</p>
    </div>
  );
}
