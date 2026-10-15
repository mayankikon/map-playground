"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { Map as MbMap } from "mapbox-gl";

import { AssetMarker, AssetPreview, KeyMarker } from "./markers";
import type { Asset } from "@/lib/types";

/**
 * Selected-vehicle focus: the vehicle always renders as its image card (whatever
 * the zoom tier), and its paired keys render at full strength. Everything else on the map is dimmed by MapView.
 */
export function FocusOverlay({ map, vehicle, keys }: { map: MbMap; vehicle: Asset; keys: Asset[] }) {
  const vehicleRef = useRef<HTMLDivElement>(null);
  const keyRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const place = () => {
      const v = map.project(vehicle.position);
      if (vehicleRef.current) vehicleRef.current.style.transform = `translate(${Math.round(v.x)}px, ${Math.round(v.y)}px)`;

      // Keys stored in the same room can land on top of each other: nudge them apart.
      const pts = keys.map((k) => map.project(k.position));
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[j].x - pts[i].x;
          const dy = pts[j].y - pts[i].y;
          const d = Math.hypot(dx, dy);
          const min = 44;
          if (d < min) {
            const ux = d ? dx / d : 1;
            const uy = d ? dy / d : 0;
            const push = (min - d) / 2;
            pts[i] = pts[i].sub({ x: ux * push, y: uy * push } as never);
            pts[j] = pts[j].add({ x: ux * push, y: uy * push } as never);
          }
        }
      }
      pts.forEach((p, i) => {
        const el = keyRefs.current[i];
        if (el) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      });
    };
    place();
    map.on("move", place);
    return () => {
      map.off("move", place);
    };
  }, [map, vehicle, keys]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-label={`${keys.length} key${keys.length === 1 ? "" : "s"} paired to the selected vehicle`}>

      {keys.map((k, i) => (
        <div
          key={k.id}
          ref={(el) => {
            keyRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 h-0 w-0"
        >
          <div className="group pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 animate-[pop-in_160ms_ease-out]">
            <KeyMarker active />
            <span className="pointer-events-none absolute bottom-[calc(100%-2px)] left-1/2 hidden -translate-x-1/2 group-hover:block">
              <span className="block w-max">
                <AssetPreview asset={k} />
              </span>
            </span>
          </div>
        </div>
      ))}

      <div ref={vehicleRef} className="absolute left-0 top-0 h-0 w-0">
        <div className="group pointer-events-auto absolute bottom-[-1px] left-0 -translate-x-1/2">
          <AssetMarker asset={vehicle} active />
          <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 hidden -translate-x-1/2 group-hover:block">
            <span className="block w-max">
              <AssetPreview asset={vehicle} />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Average spacing between scattered key tags, in px. */
const TAG_GAP = 42;
/** Clear ring around the room marker before the first tags. */
const HUB_CLEAR = 52;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Small stable 0..1 values from a key id, for jitter. */
function seeded(id: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Tag offsets (px) scattered all around the room marker: a sunflower spiral, so the
 * tags fill an even disc without overlapping, nudged a little so it doesn't look ruled.
 */
function scatter(keys: Asset[]) {
  const pts = keys.map((k, i) => {
    const r = Math.sqrt(HUB_CLEAR * HUB_CLEAR + (TAG_GAP * TAG_GAP * (i + 0.5)) / Math.PI);
    const a = i * GOLDEN + (seeded(k.id, 1) - 0.5) * 0.35;
    const jr = (seeded(k.id, 2) - 0.5) * 8;
    return { x: Math.cos(a) * (r + jr), y: Math.sin(a) * (r + jr) };
  });
  // Relax: push apart tags closer than MIN_GAP and keep them off the room marker.
  const MIN_GAP = 41; // square tags: diagonal neighbours need more than the 27px tag width
  for (let it = 0; it < 120; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < MIN_GAP) {
          const push = (MIN_GAP - d) / 2;
          pts[i].x -= (dx / d) * push;
          pts[i].y -= (dy / d) * push;
          pts[j].x += (dx / d) * push;
          pts[j].y += (dy / d) * push;
        }
      }
      const r = Math.hypot(pts[i].x, pts[i].y) || 0.01;
      if (r < HUB_CLEAR) {
        pts[i].x *= HUB_CLEAR / r;
        pts[i].y *= HUB_CLEAR / r;
      }
    }
  }
  return pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

/**
 * Keys stored in an open room (gateway), drawn as key tags scattered around the
 * room's marker. Hover a tag for its details; click it to open its vehicle.
 */
export function RoomKeysOverlay({
  map,
  center,
  keys,
  highlightId,
  onOpenKey,
}: {
  map: MbMap;
  center: [number, number];
  keys: Asset[];
  highlightId?: string | null;
  onOpenKey: (keyId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spots = useMemo(() => scatter(keys), [keys]);

  useLayoutEffect(() => {
    const place = () => {
      const p = map.project(center);
      if (ref.current) ref.current.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    };
    place();
    map.on("move", place);
    return () => {
      map.off("move", place);
    };
  }, [map, center]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-label={`${keys.length} keys in this room`}>
      <div ref={ref} className="absolute left-0 top-0 h-0 w-0">
        {/* Hovering a tag (or its row in the panel) fades the other tags to 50%. */}
        <div className="absolute left-0 top-0 [&:has(button:hover)_button:not(:hover)]:opacity-[.65] [&:has(button:hover)_button:not(:hover)]:saturate-[.9]">
          {keys.map((k, i) => (
            <div key={k.id} className="absolute size-0" style={{ left: spots[i].x, top: spots[i].y }}>
              <button
                type="button"
                onClick={() => onOpenKey(k.id)}
                aria-label={`Open the vehicle for ${k.code ? `key ${k.code}` : "this key"}`}
                className={`group pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[pop-in_160ms_ease-out_both] transition-opacity duration-150 hover:z-10 ${highlightId === k.id ? "z-10" : highlightId ? "opacity-[.65] saturate-[.9]" : ""}`}
              >
                <span className="block scale-[0.85]">
                  <KeyMarker active={highlightId === k.id} />
                </span>
                <span className="pointer-events-none absolute bottom-[calc(100%-2px)] left-1/2 hidden -translate-x-1/2 group-hover:block">
                  <span className="block w-max">
                    <AssetPreview asset={k} />
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Keys of an In Lot / Off Lot bucket, each drawn as a key tag at its own position. */
export function GroupKeysOverlay({
  map,
  keys,
  highlightId,
  onOpenKey,
}: {
  map: MbMap;
  keys: Asset[];
  highlightId?: string | null;
  onOpenKey: (keyId: string) => void;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const place = () =>
      keys.forEach((k, i) => {
        const p = map.project(k.position);
        const el = refs.current[i];
        if (el) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      });
    place();
    map.on("move", place);
    return () => {
      map.off("move", place);
    };
  }, [map, keys]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden [&:has(button:hover)_button:not(:hover)]:opacity-[.65] [&:has(button:hover)_button:not(:hover)]:saturate-[.9]" aria-label={`${keys.length} keys in this bucket`}>
      {keys.map((k, i) => (
        <div
          key={k.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute left-0 top-0 size-0"
        >
          <button
            type="button"
            onClick={() => onOpenKey(k.id)}
            aria-label={`Open the vehicle for ${k.code ? `key ${k.code}` : "this key"}`}
            className={`group pointer-events-auto absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 animate-[pop-in_160ms_ease-out_both] transition-opacity duration-150 hover:z-10 ${highlightId === k.id ? "z-10" : highlightId ? "opacity-[.65] saturate-[.9]" : ""}`}
          >
            <KeyMarker active={highlightId === k.id} />
            <span className="pointer-events-none absolute bottom-[calc(100%-2px)] left-1/2 hidden -translate-x-1/2 group-hover:block">
              <span className="block w-max">
                <AssetPreview asset={k} />
              </span>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
