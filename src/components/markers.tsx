/* eslint-disable @next/next/no-img-element -- map markers are plain DOM images */
"use client";

import { FIGMA, STOCK_COLOR, TYPE_BY_ID, assetTitle, fmtMiles, fmtMoney } from "@/lib/catalog";
import type { Asset, InventoryAge } from "@/lib/types";
import { BatteryFull, BatteryLow, BatteryMedium } from "lucide-react";
import { ago, keyInfo } from "@/lib/vehicleInfo";
import { useVehicleLookup, useVersion } from "./version";

/*
 * Map asset anatomy from Figma "Inventory Management" → Map Assets (15099:114724).
 * Each marker shows its hover state when `active` is set or when an ancestor with
 * the `group` class is hovered.
 */

const swap = (active?: boolean) => (active ? "opacity-100" : "opacity-0 group-hover:opacity-100");

/** Vehicle image marker: 74×44 shield in the inventory-age color with the car photo. */
export function VehicleCard({
  age,
  image,
  noImage,
  reporting = true,
  active,
}: {
  age: InventoryAge;
  image?: string;
  noImage?: boolean;
  reporting?: boolean;
  active?: boolean;
}) {
  return (
    <div className="relative h-[44px] w-[74px] drop-shadow-[0px_4px_2px_rgba(0,0,0,0.25)]">
      <div className="absolute inset-[2.27%_8.11%]">
        <img alt="" src={FIGMA.shield[age]} className="absolute inset-0 block size-full" />
        <img alt="" src={FIGMA.shieldHover[age]} className={`absolute inset-0 block size-full transition-opacity ${swap(active)}`} />
      </div>
      {noImage ? (
        <div className="absolute inset-[-2.27%_16.22%_2.27%_16.22%]">
          <img alt="" src={FIGMA.carPlaceholder} className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-contain" />
        </div>
      ) : image ? (
        <img alt="" src={image} className="pointer-events-none absolute left-[10px] top-[4px] h-[28px] w-[54px] rounded-[3px] object-cover" />
      ) : (
        <div className="absolute inset-[-15.91%_13.51%_6.82%_13.51%]">
          <img alt="" src={FIGMA.carPhoto} className="pointer-events-none absolute inset-0 size-full object-cover" />
        </div>
      )}
      {!reporting && <img alt="Non-reporting" src={FIGMA.tagNonReporting} className="absolute inset-[-18.18%_-4.05%_72.73%_77.03%] block" />}
    </div>
  );
}

/** Installation exception marker: neutral shield with GPS device glyph + exception tag. */
export function DeviceCard({ active }: { active?: boolean }) {
  return (
    <div className="relative h-[44px] w-[74px] drop-shadow-[0px_4px_2px_rgba(0,0,0,0.25)]">
      <div className="absolute inset-[2.27%_8.11%]">
        <img alt="" src={FIGMA.shield.device} className="absolute inset-0 block size-full" />
        <img alt="" src={FIGMA.shieldHover.device} className={`absolute inset-0 block size-full transition-opacity ${swap(active)}`} />
      </div>
      <div className="absolute inset-[18.18%_33.78%_27.27%_33.78%] overflow-clip">
        <img alt="" src={FIGMA.gpsDevice} className="absolute inset-[0_16.67%] block h-full w-[66.66%]" />
      </div>
      <img alt="Installation exception" src={FIGMA.tagDeviceException} className="absolute inset-[-18.18%_-4.05%_72.73%_77.03%] block" />
    </div>
  );
}

/** Key marker: 48×48 hit area, 32px blue tile, translucent halo on hover. */
export function KeyMarker({ active }: { active?: boolean }) {
  return (
    <div className="relative size-[48px]">
      <div className={`absolute inset-[-4.17%] rounded-[14px] bg-[#336c8b] transition-opacity ${active ? "opacity-40" : "opacity-0 group-hover:opacity-40"}`} />
      <div className="absolute inset-[16.67%] rounded-[4px] border-2 border-solid border-[#336c8b] bg-[#17a5e6] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <div className="absolute inset-[-2px] rounded-[inherit] shadow-[inset_0px_0px_12px_0px_rgba(0,0,0,0.15)]" />
      </div>
      <img alt="" src={FIGMA.keyPaired} className="absolute inset-1/4 block size-1/2" />
    </div>
  );
}

/** Mid-zoom "Marker" style pin for vehicles. */
export function VehiclePin({ age, active, size = 48 }: { age: InventoryAge; active?: boolean; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <img alt="" src={FIGMA.pin[age]} className="absolute inset-0 block size-full" />
      <img alt="" src={FIGMA.pinHover[age]} className={`absolute inset-0 block size-full transition-opacity ${swap(active)}`} />
    </div>
  );
}

/** Image-tier marker for any asset. */
export function AssetMarker({ asset, active }: { asset: Asset; active?: boolean }) {
  const t = TYPE_BY_ID[asset.typeId];
  if (t?.kind === "key") return <KeyMarker active={active} />;
  if (t?.kind === "device") return <DeviceCard active={active} />;
  return <VehicleCard age={t?.age ?? "new"} image={asset.image} noImage={asset.noImage} reporting={asset.reporting} active={active} />;
}

/** Small glyph for lists: the mid-zoom pin for vehicles, scaled markers otherwise. */
export function AssetGlyph({ asset, size = 36 }: { asset: Asset; size?: number }) {
  const t = TYPE_BY_ID[asset.typeId];
  if (t?.kind === "vehicle") return <VehiclePin age={t.age ?? "new"} size={size} />;
  const scale = t?.kind === "key" ? size / 40 : size / 64;
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }}>
      <div style={{ transform: `scale(${scale})` }}>{t?.kind === "key" ? <KeyMarker /> : <DeviceCard />}</div>
    </div>
  );
}

/* ---------------- Previews (hover popovers) ---------------- */

export function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[300px] pb-2 drop-shadow-[0px_6px_8px_rgba(0,0,0,0.12)]">
      <div className="relative flex w-full flex-col items-start rounded-[8px] bg-white px-4 py-3">
        <div className="flex flex-col items-start gap-[2px]">{children}</div>
        {/* Figma "Point". Overlaps the card by 1px so no seam shows between them. */}
        <img alt="" src={FIGMA.point} className="absolute left-1/2 top-[calc(100%-1px)] block h-[9px] w-[16px] -translate-x-1/2 -scale-y-100" />
      </div>
    </div>
  );
}

const Title = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-full items-center gap-1">
    <p className="max-w-[268px] truncate text-[16px] font-semibold leading-normal text-[#111]">{children}</p>
  </div>
);
const Sub = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`max-w-[268px] truncate text-[14px] leading-[19px] text-[#666] ${className}`}>{children}</p>
);

export function AssetPreview({ asset }: { asset: Asset }) {
  const kind = TYPE_BY_ID[asset.typeId]?.kind;
  if (kind === "vehicle") {
    return (
      <PreviewShell>
        <Title>{assetTitle(asset)}</Title>
        <Sub>
          {asset.vin} • {asset.stock}
        </Sub>
        <Sub>
          <span style={{ color: asset.condition ? STOCK_COLOR[asset.condition] : undefined }}>{asset.condition}</span>
          {` • ${fmtMoney(asset.price)} • ${fmtMiles(asset.miles)}`}
        </Sub>
        {!asset.reporting && <Sub className="!text-[#B10F2E]">Not reporting</Sub>}
      </PreviewShell>
    );
  }
  if (kind === "key") return <KeyPreview asset={asset} />;
  return (
    <PreviewShell>
      <Title>{assetTitle(asset)}</Title>
      <Sub className={asset.reporting ? "" : "!text-[#B10F2E]"}>{asset.reporting ? "Location up to date" : "Not reporting"}</Sub>
    </PreviewShell>
  );
}

/** Key tooltip: Key ID (+ battery), the paired vehicle, last report. Clicking the key opens that vehicle. */
function KeyPreview({ asset }: { asset: Asset }) {
  const vehicles = useVehicleLookup();
  const v = asset.vehicleId ? vehicles.get(asset.vehicleId) : undefined;
  const info = keyInfo(asset);
  return (
    <PreviewShell>
      <div className="flex items-center gap-2">
        <p className="truncate text-[16px] font-semibold text-[#111]">{assetTitle(asset)}</p>
        <KeyBattery pct={info.batteryPct} />
      </div>
      {v ? (
        <>
          <p className="mt-1 truncate text-[14px] font-semibold text-[#333]">
            {v.year} {v.make} {v.model}
          </p>
          <Sub>{v.vin}</Sub>
        </>
      ) : (
        <Sub>Not paired to a vehicle</Sub>
      )}
      <Sub>Last reported: {ago(info.reportedMinutesAgo).replace(/^Updated /, "")}</Sub>
      {v && <p className="mt-1.5 text-[12px] font-semibold text-[#007cbe]">Click to open vehicle</p>}
    </PreviewShell>
  );
}

/** Key tag battery level: icon + percentage, red when low. */
export function KeyBattery({ pct, className = "" }: { pct: number; className?: string }) {
  // V1 has no key tag battery anywhere.
  const version = useVersion();
  if (version === "v1") return null;
  const Icon = pct < 20 ? BatteryLow : pct < 60 ? BatteryMedium : BatteryFull;
  const low = pct < 20;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold ${low ? "text-[#B10F2E]" : "text-[#126550]"} ${className}`} title={`Key tag battery ${pct}%`}>
      <Icon size={18} strokeWidth={2} aria-hidden />
      {pct}%
    </span>
  );
}
