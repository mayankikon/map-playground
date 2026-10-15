"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Search, X } from "lucide-react";

import { assetTitle } from "@/lib/catalog";
import type { Asset } from "@/lib/types";

/**
 * Top-bar typeahead for vehicles and keys. Every word typed must appear somewhere in the
 * result (title, VIN, stock, Key ID, paired vehicle, room); the matching parts are set in
 * semibold. Picking a result opens that vehicle or key tag.
 */

const LIMIT = 6;

type Hit = { kind: "vehicle"; asset: Asset; title: string; sub: string } | { kind: "key"; asset: Asset; title: string; sub: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Text with every query token in semibold. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.map(escape).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-semibold text-[#111]">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

const vehicleName = (v: Asset) => `${v.year} ${v.make} ${v.model}`;

export function SearchBox({
  vehicles,
  keys,
  vehicleById,
  roomOf,
  onPickVehicle,
  onPickKey,
}: {
  vehicles: Asset[];
  keys: Asset[];
  vehicleById: Map<string, Asset>;
  /** Where a key is stored (room / In Lot / Off Lot), for its subtitle. */
  roomOf: (key: Asset) => string;
  onPickVehicle: (id: string) => void;
  onPickKey: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);

  const { vehicleHits, keyHits, vehicleTotal, keyTotal } = useMemo(() => {
    if (!tokens.length) return { vehicleHits: [], keyHits: [], vehicleTotal: 0, keyTotal: 0 };
    const matches = (hay: string) => {
      const h = hay.toLowerCase();
      return tokens.every((t) => h.includes(t));
    };
    // Title starts with the first word → ranked first.
    const rank = (title: string) => (title.toLowerCase().startsWith(tokens[0]) ? 0 : 1);

    const vh: Hit[] = vehicles
      .map((v) => ({ kind: "vehicle" as const, asset: v, title: vehicleName(v), sub: [v.vin, v.stock, v.condition].filter(Boolean).join(" • ") }))
      .filter((h) => matches(`${h.title} ${h.sub}`))
      .sort((a, b) => rank(a.title) - rank(b.title));
    const kh: Hit[] = keys
      .map((k) => {
        const v = k.vehicleId ? vehicleById.get(k.vehicleId) : undefined;
        return { kind: "key" as const, asset: k, title: assetTitle(k), sub: `${v ? vehicleName(v) : "Unpaired key"} · ${roomOf(k)}` };
      })
      .filter((h) => matches(`${h.title} ${h.sub}`))
      .sort((a, b) => rank(a.title) - rank(b.title));
    return { vehicleHits: vh.slice(0, LIMIT), keyHits: kh.slice(0, LIMIT), vehicleTotal: vh.length, keyTotal: kh.length };
  }, [tokens, vehicles, keys, vehicleById, roomOf]);

  const flat = [...vehicleHits, ...keyHits];
  const showList = open && tokens.length > 0;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (h: Hit) => {
    if (h.kind === "vehicle") onPickVehicle(h.asset.id);
    else onPickKey(h.asset.id);
    setQuery("");
    setOpen(false);
  };

  const row = (h: Hit, idx: number) => {
    const isActive = idx === active;
    const v = h.kind === "vehicle" ? h.asset : undefined;
    return (
      <li key={h.asset.id} role="option" aria-selected={isActive}>
        <button
          type="button"
          onMouseEnter={() => setActive(idx)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(h)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left ${isActive ? "bg-[#eef6f3]" : "hover:bg-[#f7f7f7]"}`}
        >
          {v ? (
            // eslint-disable-next-line @next/next/no-img-element -- local photo
            <img alt="" src={v.noImage ? "/figma/car-placeholder.png" : (v.image ?? "/figma/app/list-car.png")} className="h-9 w-12 shrink-0 rounded-[4px] bg-[#eef0f2] object-cover" />
          ) : (
            <span className="grid h-9 w-12 shrink-0 place-items-center rounded-[4px] bg-[#e8f4fb]">
              <span className="grid size-6 place-items-center rounded-[4px] border-2 border-[#336c8b] bg-[#17a5e6] text-white">
                <KeyRound size={12} />
              </span>
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-[#333]">
              <Highlight text={h.title} tokens={tokens} />
            </span>
            <span className="block truncate text-[13px] text-[#777]">
              <Highlight text={h.sub} tokens={tokens} />
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div ref={boxRef} className="relative">
      <label className="flex h-10 w-[360px] items-center gap-2 rounded-[4px] border border-[#dcdcdc] bg-[#f4f4f4] px-2 py-1.5 focus-within:border-[#1a9375] focus-within:bg-white">
        <Search size={20} className="shrink-0 text-[#666]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") return setOpen(false);
            if (!flat.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % flat.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + flat.length) % flat.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(flat[Math.min(active, flat.length - 1)]);
            }
          }}
          placeholder="Search vehicles, VIN, stock, Key ID"
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-results"
          aria-autocomplete="list"
          className="w-full bg-transparent text-[16px] leading-[22px] text-[#111] outline-none placeholder:text-[#8f8f8f]"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-6 shrink-0 place-items-center rounded-full text-[#666] hover:bg-[#e5e5e5]">
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </label>

      {showList && (
        <div id="search-results" className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[min(520px,calc(100vh-90px))] w-[420px] overflow-y-auto rounded-[8px] border border-[#dcdcdc] bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,.2)] animate-[pop-in_120ms_ease-out]">
          {flat.length === 0 ? (
            <p className="px-3 py-3 text-[14px] text-[#666]">No vehicles or keys match “{query.trim()}”.</p>
          ) : (
            <>
              {vehicleHits.length > 0 && (
                <>
                  <p className="flex justify-between px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#8f8f8f]">
                    Vehicles <span className="font-semibold normal-case tracking-normal">{vehicleTotal > LIMIT ? `${LIMIT} of ${vehicleTotal}` : vehicleTotal}</span>
                  </p>
                  <ul role="listbox" aria-label="Vehicles">
                    {vehicleHits.map((h, i) => row(h, i))}
                  </ul>
                </>
              )}
              {keyHits.length > 0 && (
                <>
                  <p className={`flex justify-between px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#8f8f8f] ${vehicleHits.length ? "mt-1 border-t border-[#eee]" : ""}`}>
                    Keys <span className="font-semibold normal-case tracking-normal">{keyTotal > LIMIT ? `${LIMIT} of ${keyTotal}` : keyTotal}</span>
                  </p>
                  <ul role="listbox" aria-label="Keys">
                    {keyHits.map((h, i) => row(h, vehicleHits.length + i))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
