"use client";

import { useEffect, useState } from "react";

import type { LngLat } from "./types";

/**
 * Street address for a position, from Mapbox reverse geocoding (same token as the map).
 * Lookups are cached per ~1 m cell and shared between callers, so hovering is cheap.
 */
const cache = new Map<string, Promise<string | null>>();

function lookup([lng, lat]: LngLat): Promise<string | null> {
  const id = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  let p = cache.get(id);
  if (!p) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    p = fetch(`https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&types=address&access_token=${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const full: string | undefined = d?.features?.[0]?.properties?.full_address;
        return full ? full.replace(/, United States$/, "") : null;
      })
      .catch(() => null);
    cache.set(id, p);
  }
  return p;
}

/** undefined while loading, null when no address is found. Pass `enabled: false` to skip the lookup. */
export function useAddress(position: LngLat, enabled = true): string | null | undefined {
  const [lng, lat] = position;
  const [result, setResult] = useState<{ id: string; address: string | null } | null>(null);
  const id = `${lng},${lat}`;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void lookup([lng, lat]).then((address) => live && setResult({ id: `${lng},${lat}`, address }));
    return () => {
      live = false;
    };
  }, [lng, lat, enabled]);
  return result?.id === id ? result.address : undefined;
}
