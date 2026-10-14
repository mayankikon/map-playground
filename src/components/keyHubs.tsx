"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Map as MbMap } from "mapbox-gl";
import { Briefcase, Building2, ChevronDown, ChevronRight, KeyRound, MapPin, Pencil, Radio, Store, Wrench, X } from "lucide-react";

import { KeyBattery, PreviewShell } from "./markers";
import { useVersion } from "./version";
import { ago, keyInfo } from "@/lib/vehicleInfo";
import { KEY_GROUPS, KEY_HUBS, type KeyHub, type KeyLocationId } from "@/lib/hubs";
import { assetTitle } from "@/lib/catalog";
import type { AppVersion, Asset, Condition } from "@/lib/types";

/* ---------------- Shared bits ---------------- */

/** Shrink an uploaded photo to at most 1000px wide JPEG so it fits in localStorage. */
async function downscaleImage(file: File, max = 1000): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / bmp.width);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

export interface KeyLocation {
  id: KeyLocationId;
  name: string;
  hub?: KeyHub;
  /** Photo of the place: the room's own, or one uploaded in the app (rooms and In Lot / Off Lot). */
  image?: string;
  /** V1: a room is shown only as its gateway (gateway id, no photo). */
  gatewayOnly?: boolean;
  keys: Asset[];
}

/** `images` holds photos uploaded in the app, by location id; they replace the bundled ones. */
export function buildLocations(byLocation: Map<KeyLocationId, Asset[]>, images: Record<string, string> = {}, version: AppVersion = "v2"): KeyLocation[] {
  const v1 = version === "v1";
  return [
    ...KEY_HUBS.map((hub) =>
      v1
        ? { id: hub.id, name: hub.gatewayId, hub, gatewayOnly: true, keys: byLocation.get(hub.id) ?? [] }
        : { id: hub.id, name: hub.name, hub, image: images[hub.id] ?? hub.image, keys: byLocation.get(hub.id) ?? [] },
    ),
    // Lot / off-lot groups only show when they actually hold keys.
    ...KEY_GROUPS.map((g) => ({ id: `group:${g.id}`, name: g.name, image: v1 ? undefined : images[`group:${g.id}`], keys: byLocation.get(`group:${g.id}`) ?? [] })).filter((g) => g.keys.length > 0),
  ];
}

const HUB_ICON = { cabinet: KeyRound, showroom: Store, parts: Wrench, tower: Building2, office: Briefcase } as const;

/** Location artwork: the room photo, an icon tile if a room has none, the pin tile for groups. */
function LocationTile({ location, className }: { location: KeyLocation; className: string }) {
  const hub = location.hub;
  if (location.gatewayOnly)
    return (
      <span className={`grid place-items-center bg-[#e5e5e5] text-[#1a9375] ${className}`}>
        <Radio size={28} strokeWidth={1.75} />
      </span>
    );
  if (location.image)
    return (
      <span className={`relative block overflow-hidden bg-[#ddd] ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local / uploaded photo */}
        <img alt="" src={location.image} className="absolute inset-0 size-full object-cover" />
      </span>
    );
  if (!hub)
    return (
      <span className={`grid place-items-center bg-[#e5e5e5] text-[#666] ${className}`}>
        <MapPin size={28} strokeWidth={1.5} />
      </span>
    );
  const Icon = HUB_ICON[hub.icon];
  return (
    <span className={`relative grid place-items-center overflow-hidden bg-gradient-to-br from-[#2b3a37] via-[#3d514c] to-[#1a9375] text-white ${className}`}>
      <span className="absolute inset-0 opacity-25 [background:repeating-linear-gradient(90deg,transparent_0_10px,rgba(255,255,255,.18)_10px_11px)]" />
      <Icon size={30} strokeWidth={1.5} className="relative" />
    </span>
  );
}

/** V2 room details: the floor a room is on (V1 rooms are bare gateways; buckets have none). */
const floorOf = (loc: KeyLocation) => (loc.hub && !loc.gatewayOnly ? loc.hub.floor : null);

function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${online ? "bg-[#e3f5ef] text-[#1a9375]" : "bg-[#eee] text-[#8f8f8f]"}`}>
      <span className={`size-1.5 rounded-full ${online ? "bg-[#1a9375]" : "bg-[#8f8f8f]"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

const CONDITION_COLOR: Record<Condition, string> = { New: "#1a9375", Preowned: "#e64b17" };

const vehicleLine = (v?: Asset) => (v ? `${v.year} ${v.make} ${v.model}` : "Unpaired key");

/* ---------------- Keys tab (list panel) ---------------- */

export function KeysTab({ locations, selectedId, onOpen }: { locations: KeyLocation[]; selectedId: KeyLocationId | null; onOpen: (id: KeyLocationId) => void }) {
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto bg-white">
      {locations.map((loc) => {
        const selected = loc.id === selectedId;
        return (
          <li key={loc.id} className="border-b border-[#e8e8e8]">
            <button
              type="button"
              onClick={() => onOpen(loc.id)}
              aria-pressed={selected}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left ${selected ? "bg-[#ececec]" : "bg-[#f7f7f7] hover:bg-[#efefef]"}`}
            >
              <LocationTile location={loc} className="h-[84px] w-[100px] shrink-0 rounded-[6px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[18px] font-semibold text-[#111]">{loc.name}</span>
                <span className="block text-[16px] text-[#666]">
                  {loc.keys.length} key{loc.keys.length === 1 ? "" : "s"}
                  {floorOf(loc) && ` · ${floorOf(loc)}`}
                </span>
              </span>
              {loc.hub && !loc.hub.online && <OnlineBadge online={false} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Location detail panel ---------------- */

/** Hover card beside the room panel: the key and the vehicle it's paired to. */
function KeyDetailsCard({ k, vehicle, location, top }: { k: Asset; vehicle?: Asset; location: KeyLocation; top: number }) {
  const online = location.hub?.online ?? true;
  const info = keyInfo(k);
  // V1: no battery / last reported block — the key, its gateway and its vehicle.
  const v1 = useVersion() === "v1";
  return (
    <div
      role="tooltip"
      style={{ top }}
      className="pointer-events-none absolute left-[476px] z-40 w-[300px] rounded-[8px] bg-white p-4 shadow-[0_8px_28px_rgba(0,0,0,.24)] ring-1 ring-[#dcdcdc] animate-[pop-in_120ms_ease-out]"
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-[6px] border-2 border-[#336c8b] bg-[#17a5e6] text-white">
          <KeyRound size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-[#111]">{assetTitle(k)}</p>
          {/* V1: the gateway id; V2: room · floor level. */}
          <p className="text-[12px] text-[#666]">
            {location.name}
            {floorOf(location) && ` · ${floorOf(location)}`}
          </p>
        </div>
        <OnlineBadge online={online} />
      </div>
      {!v1 && (
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#eee] pt-3">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#8f8f8f]">Battery</dt>
          <dd className="mt-0.5">
            <KeyBattery pct={info.batteryPct} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#8f8f8f]">Last reported</dt>
          <dd className={`mt-0.5 text-[13px] font-semibold ${online ? "text-[#111]" : "text-[#B10F2E]"}`}>{ago(info.reportedMinutesAgo).replace(/^Updated /, "")}</dd>
        </div>
      </dl>
      )}
      <div className="mt-3 border-t border-[#eee] pt-3">
        <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#8f8f8f]">Paired vehicle</p>
        {vehicle ? (
          <div className="mt-2 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local photo */}
            <img alt="" src={vehicle.noImage ? "/figma/car-placeholder.png" : vehicle.image ?? "/figma/app/list-car.png"} className="h-[54px] w-[72px] shrink-0 rounded-[4px] bg-[#eef0f2] object-cover" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#111]">{vehicleLine(vehicle)}</p>
              <p className="truncate text-[13px] text-[#666]">
                {vehicle.vin} • {vehicle.stock}
              </p>
              <p className="truncate text-[13px] text-[#666]">
                <span style={{ color: vehicle.condition ? CONDITION_COLOR[vehicle.condition] : undefined }}>{vehicle.condition}</span>
                {vehicle.price != null && ` • $${vehicle.price.toLocaleString("en-US")}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[14px] text-[#8f8f8f]">Not paired to a vehicle.</p>
        )}
      </div>
    </div>
  );
}

export function KeyLocationPanel({
  location,
  vehicleById,
  selectedKeyId,
  onOpenKey,
  onOpenVehicle,
  onHoverKey,
  onRoomImage,
  onClose,
}: {
  location: KeyLocation;
  vehicleById: Map<string, Asset>;
  selectedKeyId: string | null;
  /** Key ID clicked: open its vehicle, center the map on the key. */
  onOpenKey: (keyId: string) => void;
  /** Vehicle clicked: open it and go to it. */
  onOpenVehicle: (vehicleId: string) => void;
  /** Row hovered (null when the pointer leaves the panel): highlights its tag on the map. */
  onHoverKey?: (keyId: string | null) => void;
  /** New photo picked for this room or bucket (already downscaled, as a data URL). */
  onRoomImage?: (locationId: string, dataUrl: string) => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<{ id: string; top: number } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [stock, setStock] = useState<Condition | "all">("all");
  const [open, setOpen] = useState(false);
  const conditions = useMemo(() => {
    const set = new Set<Condition>();
    location.keys.forEach((k) => {
      const c = k.vehicleId ? vehicleById.get(k.vehicleId)?.condition : undefined;
      if (c) set.add(c);
    });
    return [...set];
  }, [location.keys, vehicleById]);
  const rows = location.keys.filter((k) => stock === "all" || vehicleById.get(k.vehicleId ?? "")?.condition === stock);

  const hoveredKey = hovered ? location.keys.find((k) => k.id === hovered.id) : undefined;
  // V1 has no place photos: rooms are bare gateways and buckets have no artwork.
  const showPhoto = !!onRoomImage;

  return (
    <>
    <section
      ref={sectionRef}
      onMouseLeave={() => {
        setHovered(null);
        onHoverKey?.(null);
      }}
      aria-label={`${location.name} keys`}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="absolute bottom-4 left-4 top-[76px] z-40 flex w-[450px] flex-col overflow-hidden rounded-[6px] bg-white shadow-[0_8px_28px_rgba(0,0,0,.28)] animate-[pop-in_140ms_ease-out]"
    >
      {showPhoto ? (
      <div className="relative shrink-0">
        <LocationTile location={location} className="h-[200px] w-full" />
        {onRoomImage && (
          <label
            title={`Upload a new photo of ${location.name}`}
            className="absolute left-3 top-3 grid size-8 cursor-pointer place-items-center rounded-full bg-[#333]/85 text-white hover:bg-[#111] focus-within:ring-2 focus-within:ring-white"
          >
            <Pencil size={15} strokeWidth={2.5} />
            <input
              type="file"
              accept="image/*"
              aria-label={`Upload a new photo of ${location.name}`}
              className="sr-only"
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                const url = await downscaleImage(file);
                if (url) onRoomImage(location.id, url);
              }}
            />
          </label>
        )}
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-[#333]/85 text-white hover:bg-[#111]">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
      ) : null}

      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[24px] font-semibold leading-tight text-[#111]">{location.name}</h2>
          {location.hub && <OnlineBadge online={location.hub.online} />}
          {!showPhoto && (
            <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid size-8 place-items-center rounded-full text-[#666] hover:bg-[#eee] hover:text-[#111]">
              <X size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <p className="mt-1 text-[18px] text-[#666]">
          {location.keys.length} key{location.keys.length === 1 ? "" : "s"}
          {floorOf(location) && ` · ${floorOf(location)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-[#e8e8e8] px-4 pb-3">
        <h3 className="text-[16px] font-bold uppercase tracking-[1.6px] text-[#111]">Keys</h3>
        <div className="relative">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 rounded-full border border-[#8f8f8f] px-3 py-1 text-[14px] text-[#111] hover:border-[#111]"
          >
            {stock === "all" ? "All Stock Types" : stock}
            <ChevronDown size={14} />
          </button>
          {open && (
            <div role="listbox" className="absolute right-0 top-[calc(100%+4px)] z-10 min-w-[160px] rounded-[4px] border border-[#dcdcdc] bg-white py-1 shadow-[0_6px_16px_rgba(0,0,0,.14)]">
              {(["all", ...conditions] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={stock === c}
                  onClick={() => {
                    setStock(c);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[14px] hover:bg-[#f4f4f4] ${stock === c ? "font-semibold" : ""}`}
                >
                  {c === "all" ? "All Stock Types" : c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((k) => {
          const v = k.vehicleId ? vehicleById.get(k.vehicleId) : undefined;
          const selected = k.id === selectedKeyId;
          return (
            <li
              key={k.id}
              className={`flex items-center gap-3 border-b border-[#e8e8e8] px-4 py-3 ${selected ? "bg-[#e5e5e5]" : "hover:bg-[#f4f4f4]"}`}
              onMouseEnter={(e) => {
                const s = sectionRef.current?.getBoundingClientRect();
                const r = e.currentTarget.getBoundingClientRect();
                // Card top in map coordinates: panel offset (76px) + row offset inside the panel.
                if (s) setHovered({ id: k.id, top: 76 + (r.top - s.top) - 8 });
                onHoverKey?.(k.id);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenKey(k.id)}
                    className="block text-left text-[16px] font-semibold text-[#111] hover:text-[#007cbe] hover:underline"
                    aria-label={`${assetTitle(k)}: open its vehicle and center the map on the key`}
                  >
                    {assetTitle(k)}
                  </button>
                  <KeyBattery pct={keyInfo(k).batteryPct} />
                  <span className="ml-auto shrink-0 text-[12px] text-[#8f8f8f]">{ago(keyInfo(k).reportedMinutesAgo).replace(/^Updated /, "")}</span>
                </span>
                {v ? (
                  <button
                    type="button"
                    onClick={() => onOpenVehicle(v.id)}
                    className="block max-w-full truncate text-left text-[14px] text-[#666] hover:text-[#111] hover:underline"
                    aria-label={`Go to ${vehicleLine(v)}`}
                  >
                    {vehicleLine(v)}
                    {v.condition && (
                      <>
                        {" · "}
                        <span style={{ color: CONDITION_COLOR[v.condition] }}>{v.condition}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="block text-[14px] text-[#8f8f8f]">{vehicleLine(v)}</span>
                )}
              </span>
              <button type="button" onClick={() => onOpenKey(k.id)} aria-label={`Open ${assetTitle(k)}`} className="rounded p-1 text-[#666] hover:bg-[#e5e5e5]">
                <ChevronRight size={16} />
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-6 text-center text-[14px] text-[#8f8f8f]">No keys here.</li>}
      </ul>
    </section>
    {hoveredKey && (
      <KeyDetailsCard k={hoveredKey} vehicle={hoveredKey.vehicleId ? vehicleById.get(hoveredKey.vehicleId) : undefined} location={location} top={hovered!.top} />
    )}
    </>
  );
}

/* ---------------- Hub markers on the map ---------------- */

function useMapAnchor(map: MbMap, at: [number, number]) {
  const ref = useRef<HTMLDivElement>(null);
  const [lng, lat] = at;
  useLayoutEffect(() => {
    const place = () => {
      const p = map.project([lng, lat]);
      if (ref.current) ref.current.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    };
    place();
    map.on("move", place);
    return () => {
      map.off("move", place);
    };
  }, [map, lng, lat]);
  return ref;
}

function HubMarker({ map, location, selected, onOpen }: { map: MbMap; location: KeyLocation; selected: boolean; onOpen: () => void }) {
  const ref = useMapAnchor(map, location.hub!.position);
  const online = location.hub!.online;
  return (
    <div ref={ref} className="absolute left-0 top-0 z-[4] h-0 w-0 hover:z-[8]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${location.name}, ${online ? "online" : "offline"}, ${location.keys.length} keys`}
        className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-[10px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className={`absolute -inset-[5px] rounded-[12px] transition-opacity ${selected ? "bg-[#1a9375]/45 opacity-100" : "bg-[#1a9375]/35 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`} />
        <span
          className={`relative grid size-[40px] place-items-center rounded-[8px] border-2 bg-white shadow-[0_4px_4px_rgba(0,0,0,.25)] ${online ? "border-[#1a9375] text-[#1a9375]" : "border-[#99a3ad] text-[#8f8f8f]"}`}
        >
          <Radio size={20} strokeWidth={2.25} />
        </span>
        {/* Hover / focus preview */}
        <span className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 hidden -translate-x-1/2 group-hover:block group-focus-visible:block">
          <span className="block w-max">
            <PreviewShell>
              <span className="flex items-center gap-2">
                <span className="text-[16px] font-semibold text-[#111]">{location.name}</span>
                <OnlineBadge online={online} />
              </span>
              {floorOf(location) && <span className="mt-0.5 block text-[13px] text-[#666]">{floorOf(location)}</span>}
              <span className="mt-1.5 flex items-center gap-2 rounded-[4px] bg-[#f4f4f4] px-2 py-1 text-[14px] font-semibold text-[#111]">
                <KeyRound size={14} className="text-[#1a9375]" />
                {location.keys.length} Keys {online ? "Reporting" : "Last reported"}
              </span>
            </PreviewShell>
          </span>
        </span>
      </button>
    </div>
  );
}

export function HubMarkers({ map, locations, selectedId, onOpen }: { map: MbMap; locations: KeyLocation[]; selectedId: KeyLocationId | null; onOpen: (id: KeyLocationId) => void }) {
  return (
    <>
      {locations
        .filter((l) => l.hub)
        .map((l) => (
          <HubMarker key={l.id} map={map} location={l} selected={l.id === selectedId} onOpen={() => onOpen(l.id)} />
        ))}
    </>
  );
}
