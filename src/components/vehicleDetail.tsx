/* eslint-disable @next/next/no-img-element -- Figma-exported icons and sample photos */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Route, Trash2 } from "lucide-react";

import { FIGMA, assetTitle, fmtMiles, fmtMoney } from "@/lib/catalog";
import { ago, vehicleInfo, vehiclePhotos } from "@/lib/vehicleInfo";
import { useVersion } from "./version";
import type { Asset, Geofence, LngLat } from "@/lib/types";

/*
 * Vehicle Details Page from Figma "Inventory Management" (node 11918:312471).
 * Assets live in /figma/detail.
 */

const D = (name: string) => `/figma/detail/${name}`;

export interface PairedKey {
  key: Asset;
  /** Where the key is: key location name, "On the Lot" or "Off-Lot". */
  locationName: string;
  position: LngLat;
}

interface Props {
  vehicle: Asset;
  geofences: Geofence[];
  keys: PairedKey[];
  batteryLow: boolean;
  onClose: () => void;
  onFly: (p: LngLat) => void;
  onUpdate: (patch: Partial<Asset>) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/* ---------------- Pieces ---------------- */

function SectionHeader({ title, onEdit, caption }: { title: string; onEdit?: () => void; caption?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-4">
        <h3 className="flex-1 text-[16px] font-bold uppercase leading-[19px] tracking-[1.92px] text-[#111]">{title}</h3>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`} className="rounded p-0.5 hover:bg-[#f4f4f4]">
            <img alt="" src={D("edit.svg")} className="size-6" />
          </button>
        )}
      </div>
      {caption && <p className="text-[12px] leading-4 text-[#666]">{caption}</p>}
    </div>
  );
}

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="w-[130px] shrink-0 text-[16px] leading-[22px] text-[#6d7a88]">{label}</p>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 text-right text-[16px] leading-[22px] text-[#181b1e]">{children}</div>
    </div>
  );
}

const Divider = () => <div className="h-px w-full bg-[#dcdcdc]" />;

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${label}: ${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <img key={i} alt="" src={D(i < value ? "star-filled.svg" : "star-outline.svg")} className="size-5" />
      ))}
    </span>
  );
}

function LocationRow({ icon, title, subtitle, onLocate }: { icon: string; title: string; subtitle: string; onLocate: () => void }) {
  return (
    <div className="flex h-[82px] flex-col justify-center">
      <div className="flex flex-1 items-center gap-4 py-5">
        <img alt="" src={D(icon)} className="size-6" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-[#111]">{title}</p>
          <p className="text-[14px] leading-[19px] text-[#666]">{subtitle}</p>
        </div>
        <button type="button" onClick={onLocate} aria-label={`Show ${title} on the map`} className="rounded p-0.5 hover:bg-[#e7f4ef]">
          <img alt="" src={D("loc-center.svg")} className="size-6" />
        </button>
      </div>
      <Divider />
    </div>
  );
}

/* ---------------- Gallery ---------------- */

function Gallery({ vehicle, onClose }: { vehicle: Asset; onClose: () => void }) {
  const photos = useMemo(() => vehiclePhotos(vehicle), [vehicle]);
  const [i, setI] = useState(0);
  const go = (d: number) => setI((n) => (n + d + photos.length) % photos.length);
  const dots = Math.min(photos.length, 7);

  return (
    <div className="relative h-[300px] w-full shrink-0 overflow-hidden bg-[#c3c3c3]" aria-roledescription="carousel" aria-label="Vehicle photos">
      {vehicle.noImage ? (
        <div className="grid size-full place-items-center bg-[#dde0e4]">
          <img alt="No image available" src={FIGMA.carPlaceholder} className="w-[70%] -scale-x-100 opacity-70" />
        </div>
      ) : (
        <img key={photos[i]} alt={`${assetTitle(vehicle)}, photo ${i + 1} of ${photos.length}`} src={photos[i]} className="size-full object-cover animate-[fade-in_180ms_ease-out]" />
      )}

      {!vehicle.noImage && (
        <>
          {[
            ["left-2", -1, "chevron-left.svg", "Previous photo"],
            ["right-2", 1, "chevron-right.svg", "Next photo"],
          ].map(([pos, d, icon, label]) => (
            <button key={label as string} type="button" onClick={() => go(d as number)} aria-label={label as string} className={`absolute top-[126px] grid size-12 place-items-center ${pos}`}>
              <span className="grid size-8 place-items-center rounded-[4px] bg-[rgba(24,27,30,0.75)] shadow-[0_4px_4px_rgba(0,0,0,.25)] hover:bg-[rgba(24,27,30,0.9)]">
                <img alt="" src={D(icon as string)} className="size-6" />
              </span>
            </button>
          ))}
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-2 backdrop-blur-[20px]">
            {Array.from({ length: dots }, (_, d) => (
              <span key={d} className={`rounded-full bg-white ${d === Math.min(i, dots - 1) ? "size-2" : d === dots - 1 && photos.length > dots ? "size-1.5 opacity-30" : "size-2 opacity-30"}`} />
            ))}
          </div>
        </>
      )}

      <button type="button" onClick={onClose} aria-label="Close vehicle details" className="absolute right-2 top-2 size-12">
        <img alt="" src={D("close.svg")} className="size-full" />
      </button>

      <div className="absolute bottom-2 right-2 flex gap-2 rounded-[4px] bg-[rgba(24,27,30,0.75)] p-2" aria-label="Status">
        <img alt="Location reporting" src={D("status-location.svg")} className="size-4" />
        <img alt="Key paired" src={D("status-key.svg")} className="size-4" />
        <img alt="Battery" src={D("status-battery.svg")} className="size-4" />
      </div>
    </div>
  );
}

/* ---------------- Panel ---------------- */

export default function VehicleDetailPanel({ vehicle: v, geofences, keys, batteryLow, onClose, onFly, onUpdate, onEdit, onDelete }: Props) {
  const info = useMemo(() => vehicleInfo(v, batteryLow), [v, batteryLow]);
  const version = useVersion();
  const [tab, setTab] = useState<"info" | "trips">("info");
  const [remarkDraft, setRemarkDraft] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const remarksRef = useRef<HTMLDivElement>(null);
  const editingRemark = remarkDraft !== null;

  // Bring the remark editor into view when "Add a Remark" opens it.
  useEffect(() => {
    if (editingRemark) remarksRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editingRemark]);
  const lot = geofences[0];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const actions: { label: string; icon: string; active?: boolean; onClick: () => void }[] = [
    { label: v.featured ? "Featured" : "Mark as Featured", icon: v.featured ? "star-filled.svg" : "action-star.svg", active: v.featured, onClick: () => onUpdate({ featured: !v.featured }) },
    {
      label: "Add a Remark",
      icon: "action-note.svg",
      onClick: () => {
        setTab("info");
        setRemarkDraft(v.remark ?? "");
      },
    },
    { label: "Send Brochure", icon: "action-share.svg", onClick: () => setToast("Brochure sending isn't connected in this prototype") },
    {
      label: "Share Location",
      icon: "action-location.svg",
      onClick: async () => {
        const url = `https://maps.google.com/?q=${v.position[1].toFixed(6)},${v.position[0].toFixed(6)}`;
        try {
          await navigator.clipboard.writeText(url);
          setToast("Location link copied");
        } catch {
          setToast(url);
        }
      },
    },
  ];

  return (
    <section
      aria-label={`${assetTitle(v)} details`}
      onKeyDown={(e) => e.key === "Escape" && !moreOpen && remarkDraft === null && onClose()}
      className="absolute bottom-4 left-4 top-[76px] z-40 flex w-[400px] flex-col overflow-hidden rounded-[6px] bg-white shadow-[0_8px_28px_rgba(0,0,0,.28)] animate-[pop-in_140ms_ease-out]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Gallery vehicle={v} onClose={onClose} />

        {/* Header */}
        <div className="flex flex-col gap-1 px-4 py-2">
          <h2 className="text-[24px] font-semibold leading-normal text-[#181b1e]">{assetTitle(v)}</h2>
          <p className="text-[18px] text-[#666]">
            {v.condition} • {fmtMoney(v.price)} • {fmtMiles(v.miles)}
          </p>
        </div>

        {/* Action bar */}
        <div className="relative flex items-start justify-center gap-[42px] px-4 py-2">
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={a.onClick} aria-pressed={a.active} className="group flex w-9 flex-col items-center gap-1">
              <span className={`flex rounded-[4px] border bg-white p-1.5 group-hover:border-[#99a3ad] ${a.active ? "border-[#e6b117]" : "border-[#dcdcdc]"}`}>
                <img alt="" src={D(a.icon)} className="size-6" />
              </span>
              <span className="w-[52px] text-center text-[12px] leading-normal text-[#666]">{a.label}</span>
            </button>
          ))}
          <div className="relative flex flex-col items-center gap-1">
            <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen} aria-label="More actions" className="flex rounded-[4px] border border-[#dcdcdc] bg-white p-1.5 hover:border-[#99a3ad]">
              <img alt="" src={D("action-more.svg")} className="size-6" />
            </button>
            <span className="text-[12px] text-[#666]">More</span>
            {moreOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-10 w-[180px] rounded-[4px] border border-[#dcdcdc] bg-white py-1 shadow-[0_6px_16px_rgba(0,0,0,.14)]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[#111] hover:bg-[#f4f4f4]"
                >
                  <Pencil size={14} /> Edit details
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[#b10f2e] hover:bg-[#fdf2f4]"
                >
                  <Trash2 size={14} /> Delete vehicle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" className="sticky top-0 z-[5] flex h-[49px] bg-white">
          {(["info", "trips"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 border-b text-[14px] font-semibold uppercase tracking-[1.5px] ${tab === t ? "border-b-[3px] border-[#1a9375] text-[#1a9375]" : "border-[#dcdcdc] text-[#555] hover:text-[#111]"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "trips" ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Route size={28} className="text-[#99a3ad]" />
            <p className="text-[16px] font-semibold text-[#111]">No trips recorded yet</p>
            <p className="text-[14px] text-[#666]">Test drives and moves will show here once the GPS device reports a trip.</p>
          </div>
        ) : (
          <div className="pb-4">
            {/* Location */}
            <div className="px-4 pt-4">
              <SectionHeader title="Location" />
              <LocationRow
                icon="loc-gps.svg"
                title={lot?.name ?? "Off lot"}
                subtitle={v.reporting ? ago(0) : `Last reported ${ago(info.reportedMinutesAgo).replace("Updated ", "")}`}
                onLocate={() => onFly(v.position)}
              />
              {keys.map(({ key, locationName, position }, n) => (
                <LocationRow key={key.id} icon="loc-key.svg" title={version === "v0" ? assetTitle(key) : locationName} subtitle={ago(n === 0 ? 23 : 60 * (n + 3))} onLocate={() => onFly(position)} />
              ))}
              {keys.length === 0 && <p className="py-4 text-[14px] text-[#8f8f8f]">No key paired to this vehicle.</p>}
            </div>

            {/* Remarks */}
            {(remarkDraft !== null || v.remark) && (
              <div ref={remarksRef} className="flex flex-col gap-3 px-4 pt-4">
                <SectionHeader title="Remarks" onEdit={remarkDraft === null ? () => setRemarkDraft(v.remark ?? "") : undefined} />
                {remarkDraft !== null ? (
                  <>
                    <textarea
                      autoFocus
                      value={remarkDraft}
                      onChange={(e) => setRemarkDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setRemarkDraft(null)}
                      rows={3}
                      placeholder="Add a remark for your team"
                      className="w-full rounded-[4px] border border-[#dcdcdc] p-2 text-[16px] text-[#111] outline-none focus:border-[#1a9375]"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setRemarkDraft(null)} className="rounded-[4px] px-3 py-1.5 text-[14px] font-semibold text-[#666] hover:bg-[#f4f4f4]">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdate({ remark: remarkDraft.trim() || undefined });
                          setRemarkDraft(null);
                        }}
                        className="rounded-[4px] bg-[#1a9375] px-3 py-1.5 text-[14px] font-semibold text-white hover:bg-[#126550]"
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-[16px] leading-[22px] text-[#181b1e]">{v.remark}</p>
                )}
                <Divider />
              </div>
            )}

            {/* Basics */}
            <div className="flex flex-col gap-4 px-4 pt-4">
              <SectionHeader title="Basics" onEdit={onEdit} />
              <Pair label="VIN">{v.vin}</Pair>
              <Pair label="Device ID">{info.deviceId}</Pair>
              {keys.map(({ key }) => (
                <Pair key={key.id} label="Key ID">
                  {key.code}
                </Pair>
              ))}
              <Pair label="Stock Number">{v.stock}</Pair>
              <Pair label="Exterior Color">{info.exterior}</Pair>
              <Pair label="Interior Color">{info.interior}</Pair>
              <Pair label="Battery Level">
                <span
                  aria-hidden
                  className="inline-block size-6"
                  style={
                    info.batteryLow
                      ? { backgroundColor: "#E50C0C", mask: `url(${D("battery-full.svg")}) center / contain no-repeat`, WebkitMask: `url(${D("battery-full.svg")}) center / contain no-repeat` }
                      : { background: `url(${D("battery-full.svg")}) center / contain no-repeat` }
                  }
                />
                {info.batteryVolts.toFixed(1)}v
              </Pair>
              <Pair label="Inventory Age">{info.inventoryDays} days</Pair>
              <Pair label="Vehicle Type">{info.spec.type}</Pair>
              <Divider />
            </div>

            {/* Specifications */}
            <div className="flex flex-col gap-4 px-4 pt-4">
              <SectionHeader title="Specifications" />
              <Pair label="Drivetrain">{info.spec.drivetrain}</Pair>
              <Pair label="Transmission">{info.spec.transmission}</Pair>
              <Pair label="Engine">{info.spec.engine}</Pair>
              <Pair label="Cylinders">{info.spec.cylinders}</Pair>
              <Pair label="EPA Mileage">{info.spec.mpg}</Pair>
              <Pair label="Fuel type">{info.spec.fuel}</Pair>
              <Pair label="Doors">{info.spec.doors}</Pair>
              <Pair label="Seats">{info.spec.seats}</Pair>
              <Divider />
            </div>

            {/* CARFAX */}
            <div className="px-4 pt-2">
              <div className="mt-2 flex items-center rounded-[8px] bg-[#00476d] px-4 py-6">
                <img alt="CARFAX" src={D("carfax-logo.png")} className="h-[27px] w-36 object-cover" />
                <a href="#" onClick={(e) => e.preventDefault()} className="flex-1 text-right text-[16px] text-[#f1fffa] underline hover:no-underline">
                  See Full Report
                </a>
              </div>
            </div>

            {/* Safety */}
            <div className="flex flex-col gap-4 px-4 pt-4">
              <SectionHeader title="Safety Ratings" caption="Reported by NHTSA" />
              <Pair label="Overall Rating">
                <Stars value={info.safety.overall} label="Overall rating" />
              </Pair>
              <Pair label="Overall Front Rating">
                <Stars value={info.safety.front} label="Overall front rating" />
              </Pair>
              <Pair label="Overall Side Rating">
                <Stars value={info.safety.side} label="Overall side rating" />
              </Pair>
              <Pair label="Rollover Rating">
                <Stars value={info.safety.rollover} label="Rollover rating" />
              </Pair>
              <Divider />
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[6px] bg-[#111]/90 px-3 py-2 text-center text-[14px] text-white animate-[pop-in_140ms_ease-out]">
          {toast}
        </div>
      )}
    </section>
  );
}
