"use client";

import { useRef } from "react";
import { Camera, ImageOff, LocateFixed, Trash2, X } from "lucide-react";

import { AssetMarker } from "./markers";
import { ASSET_TYPES, GEOFENCE_COLOR, TYPE_BY_ID, assetTitle } from "@/lib/catalog";
import type { Asset, Condition, Geofence } from "@/lib/types";

interface Props {
  asset: Asset;
  geofences: Geofence[];
  onChange: (patch: Partial<Asset>) => void;
  onDelete: () => void;
  onClose: () => void;
  onZoomTo: () => void;
}

/** Downscale an uploaded photo so it stays small enough for localStorage. */
function fileToThumb(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(/[^\d.]/g, "")) || 0);

export default function AssetDetail({ asset, geofences, onChange, onDelete, onClose, onZoomTo }: Props) {
  const type = TYPE_BY_ID[asset.typeId];
  const kind = type?.kind;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute right-4 top-[72px] z-20 flex max-h-[calc(100%-88px)] w-80 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,.18)] ring-1 ring-stroke">
      <div className="relative grid h-32 shrink-0 place-items-center bg-canvas">
        <div className="pointer-events-none scale-[1.9]">
          <AssetMarker asset={asset} active />
        </div>
        <button onClick={onClose} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-ink-2 shadow hover:text-ink" aria-label="Close">
          <X size={15} />
        </button>
        {kind === "vehicle" && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-ink shadow hover:bg-[#f7f7f7]">
              <Camera size={12} /> Photo
            </button>
            <button
              onClick={() => onChange({ noImage: !asset.noImage, image: asset.noImage ? asset.image : undefined })}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold shadow ${asset.noImage ? "bg-ink text-white" : "bg-white text-ink hover:bg-[#f7f7f7]"}`}
              title="Show the No Image state"
            >
              <ImageOff size={12} /> No image
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onChange({ image: await fileToThumb(f), noImage: false });
            e.target.value = "";
          }}
        />
      </div>

      <div className="space-y-3 overflow-y-auto p-4">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[1.2px] text-black/50">{type?.name}</div>
          <div className="text-[18px] font-semibold leading-tight">{assetTitle(asset)}</div>
        </div>

        {kind === "vehicle" && (
          <>
            <div className="grid grid-cols-[64px_1fr_1fr] gap-2">
              <Field label="Year">
                <input className="field" value={asset.year ?? ""} onChange={(e) => onChange({ year: num(e.target.value) })} />
              </Field>
              <Field label="Make">
                <input className="field" value={asset.make ?? ""} onChange={(e) => onChange({ make: e.target.value })} />
              </Field>
              <Field label="Model">
                <input className="field" value={asset.model ?? ""} onChange={(e) => onChange({ model: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <Field label="VIN">
                <input className="field font-mono text-[12px]" value={asset.vin ?? ""} onChange={(e) => onChange({ vin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Stock #">
                <input className="field" value={asset.stock ?? ""} onChange={(e) => onChange({ stock: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Condition">
                <select className="field" value={asset.condition} onChange={(e) => onChange({ condition: e.target.value as Condition })}>
                  <option>New</option>
                  <option>Preowned</option>
                </select>
              </Field>
              <Field label="Price">
                <input className="field" value={asset.price ?? ""} onChange={(e) => onChange({ price: num(e.target.value) })} />
              </Field>
              <Field label="Miles">
                <input className="field" value={asset.miles ?? ""} onChange={(e) => onChange({ miles: num(e.target.value) })} />
              </Field>
            </div>
            <Field label="Inventory age">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1">
                {ASSET_TYPES.filter((t) => t.kind === "vehicle").map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onChange({ typeId: t.id })}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-[12px] font-semibold capitalize ${
                      asset.typeId === t.id ? "bg-white shadow-sm" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                    {t.age}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {kind !== "vehicle" && (
          <>
            <Field label={kind === "key" ? "Key ID" : "Device ID"}>
              <input className="field" value={asset.code ?? ""} onChange={(e) => onChange({ code: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className="field" value={asset.address ?? ""} onChange={(e) => onChange({ address: e.target.value })} />
            </Field>
          </>
        )}

        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-stroke px-3 py-2">
          <span>
            <span className="block text-[14px] font-semibold">Reporting</span>
            <span className="block text-[12px] text-ink-2">{asset.reporting ? "Location up to date" : "Shows the non-reporting tag"}</span>
          </span>
          <input type="checkbox" checked={asset.reporting} onChange={(e) => onChange({ reporting: e.target.checked })} className="h-4 w-4 accent-[#126550]" />
        </label>

        <Field label="Location">
          <div className="font-mono text-[12px] tabular-nums text-ink-2">
            {asset.position[1].toFixed(6)}, {asset.position[0].toFixed(6)}
          </div>
          <p className="mt-0.5 text-[12px] text-[#99a3ad]">Drag the marker on the map to move it.</p>
        </Field>

        <Field label="Geofences">
          {geofences.length ? (
            <div className="flex flex-wrap gap-1">
              {geofences.map((g) => (
                <span key={g.id} className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: GEOFENCE_COLOR + "1f", color: GEOFENCE_COLOR }}>
                  {g.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[12px] text-[#99a3ad]">Outside all geofences</span>
          )}
        </Field>

        <div className="flex gap-2 pt-1">
          <button onClick={onZoomTo} className="btn-secondary flex-1">
            <LocateFixed size={14} /> Zoom to
          </button>
          <button onClick={onDelete} className="btn-secondary flex-1 hover:!border-red-200 hover:!text-danger">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#99a3ad]">{label}</div>
      {children}
    </div>
  );
}
