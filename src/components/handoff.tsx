"use client";

import { useState } from "react";
import { Check, ChevronDown, ClipboardCopy, ExternalLink, FileCode2, X } from "lucide-react";

import type { AppVersion, DisplaySettings } from "@/lib/types";

/**
 * Engineering handoff, organised by the Jira tickets it answers. Each ticket is a top-level
 * accordion; inside, every acceptance criterion says how the prototype was designed to meet
 * it, with the build specs that back it up. Values come from the running settings where
 * they exist, so the panel never drifts from what the map actually does.
 */

type Row = [label: string, value: string];
type Status = "covered" | "partial" | "open";

interface AC {
  id: string;
  /** The requirement as the ticket words it. */
  title: string;
  status: Status;
  /** One line: the design answer. Visible while collapsed. */
  summary: string;
  /** How we designed it. */
  design: string[];
  /** Build specs behind the design. */
  specs?: Row[];
  /** What's still missing (partial / open). */
  gap?: string;
  /** Live widget shown inside the criterion. */
  live?: "zoom";
  /** Step-by-step explanation of the mechanism, for engineers. */
  deepDive?: { title: string; steps: string[]; bands?: Row[]; examples?: string[]; code?: string };
}

interface Ticket {
  key: string;
  title: string;
  blocks: string;
  objective: string;
  decision?: string;
  acs: AC[];
}

const JIRA = "https://ikongps.atlassian.net/browse/";
const PROTOTYPE_URL = "https://map-playground-six.vercel.app";
const REPO_URL = "https://github.com/mayankikon/map-playground";

/** Changes in this build that sit outside the two tickets' acceptance criteria. */
interface Change {
  title: string;
  detail: string;
  specs?: Row[];
}

/** Version label as shown in the UI. */
const V = (v: AppVersion) => v.toUpperCase();

/** Every map / key element and its states, with the values to build it — for the version shown. */
function components(version: AppVersion): Change[] {
  const v0 = version === "v0";
  const v2 = version === "v2";
  const list: Change[] = [];
  list.push({
    title: "Key tag (map)",
    detail: v0
      ? "Figma “Key Marker”: blue tag with a key glyph. In V0 every key is its own tag on the map (no gateways): a vehicle's paired keys, keys stored in rooms and keys in the lot alike."
      : "Figma “Key Marker”: blue tag with a key glyph. Used for a vehicle's paired keys, keys scattered round an open gateway, and In Lot / Off Lot keys.",
    specs: [
      ["Size", v0 ? "48 px frame, 32 px tag" : "48 px frame, 32 px tag; 85% (27 px tag) when scattered round a gateway"],
      ["Default", "fill #17A5E6, 2 px border #336C8B, radius 4, shadow 0 4 4 rgba(0,0,0,.25), inset 0 0 12 rgba(0,0,0,.15)"],
      ["Hover", v0 ? "halo #336C8B at 40% (radius 14) + key tooltip above; in the Keys view every other marker, cluster and image card dims to 0.42 / 0.9 until the pointer leaves" : "halo #336C8B at 40% (radius 14) + key tooltip above"],
      ["Active", v0 ? "same halo, kept on: the row hovered in the Keys list (drawn above the dimmed map)" : "same halo, kept on: hovered row in the key panel, or the key picked from search; other tags dim"],
      ["Dimmed", "opacity 0.42 + saturate(0.9)"],
      ...(v0 ? ([["Stacking", "Keys stored in the same room sit on top of each other from zoom 18.6 — V0 has no aggregation for them (the overlap V1 / V2 solve with gateways)"]] as Row[]) : []),
      ["Click", v0 ? "opens the paired vehicle's drawer without leaving the current tab, map centred on the key; unpaired = no action" : "opens the paired vehicle (drawer, Vehicles tab, map centred on the key); unpaired = no action"],
    ],
  });
  list.push({
    title: "Key tooltip (map hover)",
    detail: "Card above the hovered key tag.",
    specs: [
      ["Content", v0 ? "Key ID · paired vehicle VIN · Last reported · Address · Lat / Long (no vehicle name, no click hint)" : `Key ID${v2 ? " + battery" : ""} · paired vehicle Year Make Model (14 px semibold) · VIN · Last reported · Gateway name (key in a room) or street address (no gateway) · Lat / Long · “Click to open vehicle” (#007CBE)`],
      ["Unpaired", "“Not paired to a vehicle”, no CTA"],
      ["Shell", "white card, radius 8, shadow; caret centred under the card, no divider"],
    ],
  });
  if (!v0)
    list.push({
      title: "Gateway (key room) marker",
      detail: "One marker per key room, from zoom 16 in the Keys view; stands in for every key stored there.",
      specs: [
        ["Size", "40 px white tile, radius 8, shadow 0 4 4 rgba(0,0,0,.25), Radio icon 20 px"],
        ["Online / offline", "border + icon #1A9375 / #99A3AD"],
        ["Hover / focus", `halo #1A9375 at 35% (inset −5 px, radius 12) + card: room name, Online badge${v2 ? ", floor" : ""}, “N Keys Reporting”`],
        ["Selected (panel open)", "halo #1A9375 at 45%, kept on"],
        ["Click", "opens the key panel, flies to zoom ≥ 18.6 (+233 px x), scatters its key tags, dims the map"],
      ],
    });
  list.push(
    v0
      ? {
          title: "Keys list row (V0)",
          detail: "The Keys tab is one flat list of every key tag, sorted by Key ID — no rooms, no buckets, no stock type filter.",
          specs: [
            ["Content", "Key ID 16 px semibold · lat, long 12 px #8F8F8F with pin icon, right-aligned · vehicle line (Year Make Model) 14 px #666 · chevron. No key icon, battery, report time or stock type"],
            ["Default / hover / selected", "#FFFFFF / #F4F4F4 / #E5E5E5"],
            ["Hover", "Key Details card beside the list; that key's tag is drawn above the dimmed map (everything else 0.42 / 0.9), and the map pans to it if it is off-screen (no zoom change)"],
            ["Click", "whole row: stays on the Keys tab, the row stays selected (#E5E5E5) and the paired vehicle's drawer opens over the map, centred on the key; no Key Details card while the drawer is open; unpaired = no action"],
          ],
        }
      : {
          title: "Key panel row",
          detail: "One row per key in the open gateway / bucket.",
          specs: [
            ["Content", `Key ID 16 px semibold${v2 ? " · battery" : ""} · lat, long 12 px #8F8F8F with pin icon, right-aligned (replaces the report time) · vehicle line 14 px #666 + stock type colour · chevron`],
            ["Default / hover / selected", "#FFFFFF / #F4F4F4 / #E5E5E5"],
            ["Hover", "opens the Key Details card beside the panel; its map tag goes active, the other tags dim to 0.42"],
            ["Click", "whole row = Key ID: paired vehicle drawer, map centred on the key; vehicle line = vehicle framed with its keys"],
          ],
        },
  );
  list.push({
    title: "Key Details card (row hover)",
    detail: v0 ? "300 px card, fixed just right of the Keys list, top aligned to the hovered row." : "300 px card at left 476 px, top aligned to the hovered row.",
    specs: [
      [
        V(version),
        v0
          ? "Key ID │ Address · Lat / Long │ Paired vehicle (photo 72×54, name, VIN • stock, stock type • price). No room, no online / offline badge, no Battery / Last reported block"
          : v2
            ? "Key ID · room · floor · Online badge │ Battery · Last reported │ Gateway or Address · Lat / Long │ Paired vehicle (photo 72×54, name, VIN • stock, stock type • price)"
            : "Key ID · room · Online badge │ Gateway or Address · Lat / Long │ Paired vehicle (no Battery / Last reported block)",
      ],
      ["Lat / Long", "“32.925, -97.069”: latitude first, 3 decimals max, tabular figures"],
      ["Pointer", "stays open while the pointer moves from the row onto it (200 ms grace); closes when it leaves both"],
      ["Click", v0 ? "anywhere on the card = clicking its row: opens the paired vehicle's drawer on the Keys tab, row selected, map centred on the key" : "anywhere on the card = clicking its row: opens the paired vehicle"],
      ["Unpaired", "“Not paired to a vehicle.”"],
    ],
  });
  if (!v0)
    list.push({
      title: "Key panel header",
      detail: "Top of the 450 px key panel.",
      specs: [
        [V(version), v2 ? "4:3 room photo with pencil (upload, top-left) and ✕ (top-right); name 24 px semibold + Online badge; “N keys · Floor N” 18 px" : "no photo or pencil; name + badge + ✕ in one row; “N keys”"],
        ["Filter", "All Stock Types · New · Preowned · Loaner · Demo · Service · BVA"],
      ],
    });
  list.push(
    {
      title: "Cluster bubble",
      detail: "Count of vehicles (see NG4-8068 AC3 for when one forms). Number only: zoomed all the way out there is no building / group icon, even for the bubble over the dealership building.",
      specs: [
        ["Default", "white fill, 1.5 px stroke #DCDCDC, shadow (black 22%, blur .5, y +4); count DIN Pro Bold 15"],
        ["Content", "The count only. No building / group icon at any zoom — the DS Map Marker “Group” style (building glyph) is not used; a cluster over the building reads as a plain number"],
        ["Keys view", v0 ? "Keys follow the same rules as vehicles: below zoom 18.6 every key is inside a number-only bubble (a lone key shows “1”); from 18.6 every key is its own tag (no gateways)" : "Below zoom 16 keys stored in rooms count into the same number-only bubbles; from zoom 16 they become gateway markers"],
        ["Size", "radius 15 px (< 100), 18 px (100–999), 22 px (≥ 1000)"],
        ["Hover", "fill #F1FFFA, stroke #99A3AD, ring #48A991 at 40% (radius + 10)"],
        ["Dimmed", "opacity 0.42, shadow 0.092"],
        ["Click", "zooms in until the vehicles separate into pins"],
      ],
    },
    {
      title: "Vehicle pin",
      detail: "Figma map-marker pin, coloured by inventory age; zoom 18.6–19.2.",
      specs: [
        ["Default", "pin icon: 0–45 #00B397 · 46–90 #E6B117 · 90+ #E50C0C"],
        ["Hover / selected", "pin-hover icon variant + tooltip (Year Make Model, VIN • stock, stock type • price • miles)"],
        ["Dimmed", "icon-opacity 0.42 and the “-dim” icon copy (saturation 0.9)"],
      ],
    },
    {
      title: "Vehicle image card",
      detail: "Photo marker from zoom 19.2, and the selected vehicle at any zoom.",
      specs: [
        ["Size", "74 × 44 shield, photo 54 × 28 radius 3, drop shadow 0 4 2 rgba(0,0,0,.25), anchored bottom-centre"],
        ["Hover / selected", "shield-hover variant + tooltip"],
        ["Non-reporting", "tag badge top-right"],
        ["Dimmed", "marker filter saturate(0.9); card opacity 0.42"],
      ],
    },
    {
      title: "Search",
      detail: "Top-bar typeahead.",
      specs: [
        ["Idle / focused", "360 px, #F4F4F4 fill, #DCDCDC border / white fill, #1A9375 border; ✕ appears with text"],
        ["Results", "Vehicles (photo, name, VIN) then Keys (icon, Key ID); up to 6 each; matched text semibold"],
        ["Pick a key", v0 ? "opens the paired vehicle (no room to open)" : "opens the key's gateway / bucket; its tag and row stay highlighted, row scrolled into view"],
        ["Hover / keyboard active", "#F2F2F2; ↑ ↓ Enter Esc"],
        ["No results", "“No vehicles or keys match “…”.”"],
      ],
    },
    {
      title: "Collapsed list button",
      detail: "Left edge of the map when the list panel is collapsed.",
      specs: [
        ["Content", "“Show N vehicles & N keys” 14 px semibold + » icon; counts follow the map filters"],
        ["Hover", "#F4F4F4"],
      ],
    },
  );
  return list;
}

/** Changes in this build that sit outside the two tickets' acceptance criteria — for the version shown. */
function changes(version: AppVersion): Change[] {
  const v0 = version === "v0";
  return [
    ...(v0
      ? ([
          {
            title: "V0 key tooltip and vehicle drawer key rows",
            detail: "The map key tooltip drops the vehicle name and the “Click to open vehicle” hint (clicking still opens the vehicle). In the vehicle drawer's Location section, each paired key row is titled with its Key ID instead of a room name.",
            specs: [
              ["Tooltip", "Key ID · VIN · Last reported · Address · Lat / Long"],
              ["Drawer key row", "title “Key ID: 433434”, subtitle “Updated N minutes ago”, locate button"],
            ],
          },
        ] as Change[])
      : []),
    {
      title: "Search vehicles and keys (relates to NG4-6631)",
      detail: `Top-bar typeahead. Vehicles match on Year Make Model and VIN; keys match on Key ID. Every typed word must match; matched text is semibold. Results grouped Vehicles / Keys (6 each), neutral grey hover. Picking a vehicle opens its drawer (Vehicles tab) framed with its keys; picking a key ${v0 ? "opens its paired vehicle with the map centred on the key" : "opens its room / bucket, keeps that tag at full strength (others dimmed) and scrolls its row into view"}. ↑ ↓ Enter Esc.`,
      specs: [
        ["Box", "360 px, placeholder “Search vehicle, VIN or Key ID”, clear (✕) button"],
        ["Results", "420 px dropdown; vehicle row = photo + name + VIN; key row = key icon + Key ID only; no counts"],
        ["Hover / active", "#F2F2F2"],
      ],
    },
    {
      title: "Key lat / long",
      detail: `Every key shows its position as “lat, long” (latitude first, 3 decimals max): right-aligned in each key row where the report time used to be (${v0 ? "Keys list" : "key panel"} — rows no longer show the time), in the Key Details card, and in the key tooltip on the map.`,
      specs: [["Format", "32.925, -97.069 · 12 px #8F8F8F with a 12 px pin icon, right-aligned in rows; 13 px SemiBold #111 under “LAT / LONG” in the Key Details card; tooltip line “Lat / Long: …”"],
        ["Place", v0 ? "Above lat / long in the tooltip and Key Details card: the key's street address (Mapbox reverse geocoding, cached per position; “Looking up address…” while loading). V0 has no gateways, so it's always the address." : "Above lat / long in the tooltip and Key Details card: the gateway (room) name when the key is in one, otherwise its street address (Mapbox reverse geocoding, cached per position). Never both."]],
    },
    {
      title: "Stock types",
      detail: v0
        ? "Vehicles can be New, Preowned, Loaner, Demo, Service or BVA. The map Stock Type filter and the edit form list all six; each type has its own text colour. The V0 Keys list has no stock type filter."
        : "Vehicles can be New, Preowned, Loaner, Demo, Service or BVA. Every stock type control (map Stock Type filter, key panel filter, edit form) lists all six; each type has its own text colour.",
    },
    {
      title: "Stronger dimming (42%)",
      detail: `Everything but the focus dims to opacity 0.42 (80% of the earlier 0.52, which itself replaced 0.65) and saturation 0.9: other ${v0 ? "markers while a Keys list row or a key tag on the map (Keys view) is hovered" : "key tags while a key is hovered"}, and every other pin, cluster and image card while a vehicle is selected.`,
    },
    {
      title: "Collapsed list button shows totals",
      detail: "With the list panel collapsed, the expand button reads “Show N vehicles & N keys” left of the » chevron. Counts honour the active map filters and ignore the current tab.",
    },
    {
      title: "Map always fills its area",
      detail: "The map canvas resizes whenever its container changes (ResizeObserver on the container, plus an explicit resize when the list panel opens or closes), so collapsing the list never leaves a blank strip.",
    },
    {
      title: "Vehicle / key toggle removed from the map",
      detail: v0 ? "The VEHICLES / KEYS tabs in the list panel are the only view switch." : "The VEHICLES / KEYS tabs in the list panel are the only view switch. Leaving Keys closes the open key panel.",
    },
    {
      title: `This page documents ${V(version)}`,
      detail:
        version === "v0"
          ? "V0 has no gateway concept: no gateway markers, key panel, room scatter, In Lot / Off Lot buckets or stock type filter. The Keys tab is a flat list of every key; every key is its own map tag. Switch to V1 / V2 (bottom of the nav rail) to see the gateway specs."
          : version === "v1"
            ? "V1 has gateways with real room names but no room photos, photo edit icon, floor level or key battery; its Key Details card has no Battery / Last reported block. V2 adds those; V0 drops gateways entirely."
            : "V2 is the target: gateways with room photos (editable), room · floor, key battery. V1 drops photos, floor and battery; V0 drops gateways entirely.",
    },
  ];
}

function tickets(s: DisplaySettings, version: AppVersion): Ticket[] {
  const c = s.clusterBelowZoom;
  const i = s.imageFromZoom;
  const v0 = version === "v0";
  const v2 = version === "v2";

  // NG4-8068 AC3 — same clustering rules in every version; only the keys line differs.
  const zoomAC: AC = {
    id: "8068-3",
    title: "Zoom-level adaptability",
    status: "covered",
    summary: `Clusters below ${c} · pins ${c}–${i} · image cards from ${i}.`,
    design: [
      `Three strict tiers, one per zoom range — clusters and pins never share a zoom level:`,
      `Below ${c}: clusters only. Every vehicle and key is inside a count bubble; a lone asset shows as a “1” bubble, never a pin.`,
      `From ${c}: map marker pins only, every asset individual. From ${i}: pins become photo cards.`,
      v0
        ? `Keys follow the same tiers; there are no gateways in V0, so from ${c} keys stored in one room stack as individual tags.`
        : "Keys in rooms collapse into gateways from zoom 16.",
      `A cluster is a number only — no building / group icon, even over the dealership building.${v0 ? "" : " The building itself is never a marker below zoom 16."}`,
    ],
    deepDive: {
      title: "How clustering works: one rule per zoom tier",
      steps: [
        `The earlier distance grouping (vehicles chained within ${s.groupDistance} m, ≥ ${s.clusterMinPoints} per group) is removed. It produced bubbles and pins side by side at the same zoom; the tiers are now strict.`,
        `Two GeoJSON sources carry the same points. “asset-clusters” has cluster: true, clusterRadius 50 px and clusterMaxZoom 22, so it is always clustered; its bubble layers have maxzoom ${c}.`,
        `“assets” is not clustered; the pin layer runs from minzoom ${c} to maxzoom ${i}, and image cards (HTML markers) take over from ${i}.`,
        `Two sources are needed because supercluster only switches at whole zooms (${c} would round to ${Math.floor(c)} or ${Math.ceil(c)}); the layer min / max zooms make the switch exactly at ${c}.`,
        `Below ${c}, a point with no neighbour inside 50 px stays unclustered in the source but is drawn by the same bubble layers as “1” (weight 1).`,
        `Clicking a cluster zooms to getClusterExpansionZoom() + 0.25 (at least +1, at most ${(c + 0.05).toFixed(2)}); clicking a “1” bubble goes to ${(c + 0.05).toFixed(2)} on that asset, where it becomes a pin.`,
      ],
      bands: [
        [`zoom < ${c}`, "Clusters only (count bubbles, lone assets as “1”), no pins"],
        [`${c} – ${i}`, v0 ? "Pins only → every vehicle is a pin and every key its own tag (room keys stack)" : "Pins only → every vehicle is a pin"],
        [`≥ ${i}`, "Every vehicle is an image card"],
      ],
      examples: [
        `6 cars in a row → one bubble “6” below ${c}, six pins from ${c}.`,
        `1 car parked alone → bubble “1” below ${c}, a pin from ${c}.`,
        `Two rows 12 m apart → one or two bubbles depending on screen distance (50 px), never a mix of bubbles and pins.`,
      ],
      code: `// same FeatureCollection pushed to both sources
map.addSource("asset-clusters", { type: "geojson", cluster: true,
  clusterRadius: 50, clusterMaxZoom: 22,
  clusterProperties: { weight: ["+", ["get", "weight"]] } })
map.addSource("assets", { type: "geojson" })

// bubbles: source "asset-clusters", maxzoom ${c}, no filter (singles = "1")
// pins:    source "assets", minzoom ${c}, maxzoom ${i}
// image cards (HTML markers) from ${i}`,
    },
    specs: [
      [`zoom < ${c}`, "Clusters only (count bubble; lone asset = “1”)"],
      [`${c} ≤ zoom < ${i}`, "Map marker pins only, coloured by inventory age"],
      [`zoom ≥ ${i}`, "Image cards, bottom-centre anchored"],
      ["Cluster radius", "50 px (Mapbox clustering, always on below the pin zoom)"],
      ["Bubble", "Count = summed weight; radius 15 px (< 100), 18 px (100–999), 22 px (≥ 1000)"],
    ],
    live: "zoom",
  };

  const dimSpecs: Row[] = [
    ["Dimmed state", "opacity 0.42 + saturation 0.9 (10% less) on everything but the focus"],
    ["asset-pins", "icon-opacity 1 → 0.42; icon-image swaps to “-dim” copies desaturated to 0.9 (symbols have no saturation paint)"],
    ["clusters", "circle-opacity, circle-stroke-opacity 1 → 0.42 (bubbles are neutral, no saturation change needed)"],
    ["cluster-count", "text-opacity 1 → 0.42"],
    ["cluster-shadow", "circle-opacity 0.22 → 0.092"],
    ["Image cards", "filter saturate(0.9) on the marker element; opacity 0.42 on the card inside it (Mapbox writes inline opacity on the marker element)"],
    ["Key tags", "opacity 0.42 + saturate(0.9) on non-focused tags"],
  ];

  const overlap: Ticket = {
    key: "NG4-8068",
    title: "Pin overlap behavior across vehicle, key, cluster & geofence pins",
    blocks: "NG4-7766 (A-029), NG4-7762 (A-006)",
    objective: "One UX pattern for pins that share or nearly share a coordinate: cars parked bumper-to-bumper, hundreds of key tags in one key box.",
    decision: v0
      ? "V0 is the baseline without key aggregation: vehicles and keys follow the same strict zoom tiers (clusters only below 18.6), and from zoom 18.6 every key is its own tag — keys stored in one room stack. The Keys list is the reliable way to pick a key. V1 / V2 add gateways to solve this."
      : "Resolve overlap with zoom + aggregation, not by spreading pins on click. Dense vehicles stay a cluster until street zoom; keys in one key box collapse into a single gateway that opens a list. Spider / fan-out was prototyped and dropped: small targets, and it breaks down at high counts.",
    acs: [
      v0
        ? {
            id: "8068-1",
            title: "Universal interaction pattern",
            status: "partial",
            summary: "Vehicles and keys share one cluster pattern far out; at street zoom keys stack.",
            design: [
              "Vehicles: a cluster bubble shows the count; clicking frames its vehicles at a zoom where they separate into pins.",
              `Keys: the same number-only bubbles below ${c}; from ${c} every key is its own tag. There is no gateway or key panel.`,
              "Geofences sit beneath every pin and have no tooltip, so they never block a pin or a cluster.",
            ],
            specs: [
              ["Click priority", "cluster › pin / key tag › geofence"],
              ["Cluster click", `Frame members at zoom ≥ ${c} (easeTo 700 ms)`],
              ["Layer order", "geofence fill/line → clusters → pins → HTML image cards → overlays"],
            ],
            gap: "Keys stored in the same room overlap at street zoom; picking one on the map is unreliable. V1 / V2 resolve this with gateways.",
          }
        : {
            id: "8068-1",
            title: "Universal interaction pattern",
            status: "covered",
            summary: "Every overlap reads the same way: a count marker → click → expand.",
            design: [
              "Vehicles: a cluster bubble shows the count; clicking frames its vehicles at a zoom where they separate into pins.",
              "Keys: a gateway marker stands in for every key in that room; clicking opens the key panel and scatters the room's key tags around the gateway.",
              "Geofences sit beneath every pin and have no tooltip, so they never block a pin or a cluster.",
            ],
            specs: [
              ["Click priority", "cluster › pin › geofence"],
              ["Cluster click", `Frame members at zoom ≥ ${c} (easeTo 700 ms)`],
              ["Gateway click", `Open key panel, fly to zoom ≥ ${Math.max(18.6, c)}, +233 px x-offset to clear the panel, dim the map`],
              ["Layer order", "geofence fill/line → clusters → pins → HTML image cards → overlays"],
            ],
          },
      v0
        ? {
            id: "8068-2",
            title: "High-density / worst case (500+ keys at one key box)",
            status: "open",
            summary: "Not solved in V0: no aggregation for keys in one box.",
            design: [
              "Far out, the keys in a box become one number-only bubble like any dense group.",
              "At street zoom all of them are drawn on the same spot, so the map can't single one out.",
              "The flat Keys list (sorted by Key ID, hover to locate on the map) is the way to find a specific key.",
            ],
            gap: "No gateway / list-per-box in V0. With 500+ keys in one box the tags fully overlap. V1 / V2 answer this AC.",
          }
        : {
            id: "8068-2",
            title: "High-density / worst case (500+ keys at one key box)",
            status: "partial",
            summary: "The gateway carries the count; the key panel list is the source of truth.",
            design: [
              "One gateway marker per key box, whatever the number of keys, with “N Keys Reporting” on hover.",
              "The key panel lists every key (scrollable, filter by stock type), so finding a key never depends on picking a tag on the map.",
              "On open, key tags scatter around the gateway on a sunflower spiral: even density, no overlaps, nearest keys closest to the gateway.",
            ],
            specs: [
              ["Tag spacing", "avg 42 px, min centre distance 41 px (square tags need the diagonal clearance)"],
              ["Clear ring", "52 px around the gateway marker"],
              ["Tag size", "Figma Key Marker at 85% → 27 px tag"],
              ["Tested", "104 keys in one gateway, no overlaps"],
            ],
            gap: "At 500+ keys the scatter would span ~1,000 px. Proposal: cap on-map tags (e.g. 150, most recent first) with “+N more in list”. Needs a PM call on the cap.",
          },
      zoomAC,
      {
        id: "8068-4",
        title: "States & micro-interactions",
        status: "partial",
        summary: v0 ? "Hover, selected and list-row hover are built; keyboard focus is not." : "Hover, selected and expanded/collapsed are built; keyboard focus is not.",
        design: [
          "Hover: tooltip card above the marker plus a soft halo; still works on dimmed markers.",
          "Selected: the vehicle always renders as its image card (any zoom) with its 1–2 key tags; everything else is dimmed to 42% opacity and 90% saturation.",
          "Opened from a key: only that key tag is highlighted; the vehicle's other paired key is dimmed (42% / 90%) and clicking it makes it the active key (map re-centres on it). Opened from the vehicle itself: all its key tags are highlighted.",
          v0
            ? "Keys list row hover: the Key Details card opens beside the list and that key's tag is drawn above the dimmed map (0.42 / 0.9), panning to it if off-screen. Map key-tag hover (Keys view): the hovered tag stays full, everything else dims the same way."
            : "Expanded / collapsed: a gateway opens into its key panel + tags and closes with ✕ or Esc. Hovering a key dims the other tags the same way.",
        ],
        specs: [["Selected camera", "fitBounds(vehicle + keys), padding T150 B60 L460 R90, maxZoom 19.5"], ...dimSpecs],
        gap: v0 ? "Keyboard focus ring for pins and key tags isn't defined yet." : "Keyboard focus ring for pins and key tags isn't defined yet (gateways have one).",
      },
    ],
  };

  const nav: Ticket = {
    key: "NG4-8100",
    title: "Navigation from key-only map view to paired vehicle details (A-033)",
    blocks: "NG4-7768 (A-033), NG4-6631, NG4-8167",
    objective: "From any key, reach the vehicle it belongs to in one click, without memorising details or switching to the Inventory view.",
    decision: "Clicking a key takes you back to the Vehicles list with the paired vehicle's details drawer open, on the same map: no page change, and the map shows the car with its keys.",
    acs: [
      {
        id: "8100-1",
        title: "Key Detail Card / Popup: paired vehicle summary",
        status: "covered",
        summary: v0 ? "Keys list rows, the Key Details card and the map key tooltip all show the paired vehicle." : "Key panel rows, the key detail card and the map key tooltip all show the paired vehicle.",
        design: v0
          ? [
              "Each Keys list row shows the Key ID, its lat / long, and the vehicle's Year Make Model underneath. No key icon, battery, report time or stock type.",
              "Hovering a row opens the Key Details card beside the list: key, street address, lat / long, then the paired vehicle's photo, VIN • stock and stock type • price. The key's tag is shown on the dimmed map.",
              "Hovering any key tag on the map shows a tooltip: Key ID, paired vehicle VIN, last reported, street address and lat / long (no vehicle name, no “Click to open vehicle” hint). Clicking still opens the paired vehicle.",
              "Clicking a Keys list row, or anywhere on its Key Details card, keeps you on the Keys tab: that row stays selected, the paired vehicle's drawer opens over the map (in place of the Key Details card) and the map centres on the key.",
              "Vehicle details → Location: each paired key row is titled with its Key ID (e.g. “Key ID: 433434”) instead of a room name.",
              "In the Keys view, hovering a key tag on the map keeps that tag at full strength and dims every other marker, cluster and image card to 0.42 / 0.9; leaving the tag restores them.",
            ]
          : [
              "Each row in the key panel shows the Key ID and its lat / long, with the vehicle's Year Make Model and stock type underneath.",
              "The panel's stock type filter always offers every type: All Stock Types, New, Preowned, Loaner, Demo, Service, BVA.",
              `Hovering any key tag on the map shows a tooltip: Key ID${v2 ? " + battery" : ""}, paired vehicle Year Make Model and VIN, last reported, gateway name (or street address when the key isn't in a room), lat / long, and “Click to open vehicle”.`,
              `Hovering a row opens the Key Details card: ${v2 ? "key, room · floor, status, battery, last reported, gateway or address, lat / long" : "key, room, status, gateway or address, lat / long"}, then the paired vehicle's photo, VIN • stock and stock type • price.`,
            ],
        specs: v0
          ? [
              ["Keys list", "Flat list in the list panel's KEYS tab, “Showing N keys”, sorted by Key ID; no stock type filter"],
              ["Row", "Key ID 16 px semibold; lat, long 12 px #8F8F8F right-aligned; vehicle line 14 px #666 + stock type colour"],
              ["Detail card", "300 px, radius 8, fixed just right of the list, aligned to the hovered row"],
              ["Stock type colour", "New #1A9375 · Preowned #E64B17 · Loaner #6B4FBB · Demo #0B6494 · Service #A86A00 · BVA #5B6770"],
            ]
          : [
              ["Key panel", "450 px wide, left 16 / top 76 / bottom 16, radius 6, shadow 0 8 28 rgba(0,0,0,.28)"],
              ["Row", `Key ID 16 px semibold${v2 ? "; battery ≥ 20% green / < 20% red" : ""}; lat, long 12 px #8F8F8F right-aligned (no report time); vehicle line 14 px #666 + stock type colour`],
              ["Detail card", "300 px, radius 8, beside the panel (left 476 px), aligned to the hovered row"],
              ...(v2 ? ([["Header photo", "4:3, same as the vehicle drawer gallery (400 × 300); pencil top-left to replace it"]] as Row[]) : []),
              ["Stock type colour", "New #1A9375 · Preowned #E64B17 · Loaner #6B4FBB · Demo #0B6494 · Service #A86A00 · BVA #5B6770"],
            ],
      },
      {
        id: "8100-2",
        title: "Prominent CTA to the vehicle",
        status: "covered",
        summary: v0 ? "The whole Keys list row is the link; key tags on the map are links too." : "The vehicle title is the link; Key IDs and key tags are links too.",
        design: v0
          ? [
              "Clicking anywhere on a Keys list row (or its chevron) opens the paired vehicle's details and centres the map on that key.",
              "Clicking any key tag on the map opens its paired vehicle. Keys never open an edit card; an unpaired key does nothing on click.",
              "A Key ID picked in search opens the paired vehicle directly.",
            ]
          : [
              "Vehicle line in a key row: opens the vehicle's details and frames it with its keys.",
              "Key ID, or anywhere else on the key row: opens the paired vehicle's details and centres the map on that key, for when you're walking to the key.",
              "Clicking any key on the map (room tag, In Lot / Off Lot tag, or a loose key pin) opens its paired vehicle. Keys never open an edit card; an unpaired key does nothing on click.",
            ],
        specs: v0
          ? [["Click targets", "Whole row + chevron = open paired vehicle (map centred on the key)"]]
          : [
              ["Link style", "Hover underline; Key ID hover colour #007CBE"],
              ["Click targets", "Whole key row = Key ID action; vehicle line = vehicle action (stops propagation); chevron = Key ID action"],
            ],
      },
      {
        id: "8100-3",
        title: "Navigation & transition behavior",
        status: "covered",
        summary: "Back to the Vehicles list, vehicle details drawer open, same map.",
        design: [
          v0 ? "The list switches from Keys to Vehicles and the Vehicle Detail drawer opens on the left over the map. Filters stay as they were." : "The key panel closes, the list switches from Keys to Vehicles, and the Vehicle Detail drawer opens on the left over the map. Filters stay as they were.",
          "The selected vehicle switches to its image card with its 1–2 key tags, and everything else dims to 42% opacity / 90% saturation.",
          v0 ? "Closing the drawer leaves you in the Vehicles view; the Keys tab reopens the flat keys list." : "Closing the drawer leaves you in the Vehicles view; the Keys tab reopens the gateway list.",
        ],
        specs: [
          ["Drawer", "400 px wide, left 16 / top 76 / bottom 16, radius 6, z-40"],
          ["Drawer content", "Gallery · title + price/miles · actions · INFO / TRIPS · Location (lot + each key) · Basics (all Key IDs) · Specs · CARFAX · Safety"],
          ["Camera", `${v0 ? "" : "Vehicle link: fitBounds(vehicle + keys). "}Key ID / row: flyTo(key, zoom ≥ 19.1) with offset +208 px x, so the key tag sits in the centre of the map area right of the 416 px drawer (no offset on maps < 640 px)`],
        ],
      },
      {
        id: "8100-4",
        title: "Empty / Unpaired state",
        status: "partial",
        summary: "“Unpaired key” in the row, “Not paired to a vehicle.” in the card, and no CTA.",
        design: [
          "A key with no vehicle reads “Unpaired key” where the vehicle line would be.",
          "The detail card shows “Not paired to a vehicle.” instead of the vehicle block.",
          "Clicking it does nothing — there's no vehicle to open.",
        ],
        gap: "The demo data has no unpaired keys, so the state can't be seen live yet.",
      },
      {
        id: "8100-5",
        title: "Consistency with TWEB drawers & popovers",
        status: "covered",
        summary: v0 ? "Keys list, vehicle drawer and map cards share one set of rules." : "Key panel, vehicle drawer and map cards share one set of rules.",
        design: [
          v0 ? "The Keys list lives in the standard list panel; the vehicle drawer keeps its placement, radius and shadow." : "Key panel and vehicle drawer use the same placement, radius and shadow.",
          "Map tooltips and the key detail card use the same card shell and type scale.",
        ],
        specs: [
          ["Type", "Barlow (UI), Saira (brand)"],
          ["Inventory age", "0–45 days #00B397 · 46–90 #E6B117 · 90+ #E50C0C"],
          ["Key tag", "fill #17A5E6, 2 px border #336C8B, radius 4"],
          ["Geofence", "#0B6494 fill at 30%, 2 px white stroke"],
        ],
      },
    ],
  };

  return [overlap, nav];
}

/**
 * Self-contained build prompt for a coding agent working in the production codebase: carries
 * the product context, the reference prototype, how to apply the changes, every spec and an
 * acceptance checklist, so pasting it is enough to bring prod in line with this prototype.
 */
function toBuildPrompt(list: Ticket[], version: AppVersion) {
  const approved = list.flatMap((t) => t.acs.filter((a) => a.status === "covered").map((a) => `- [ ] ${t.key} · ${a.title}: ${a.summary}`));
  const open = list.flatMap((t) => t.acs.filter((a) => a.gap).map((a) => `- ${t.key} · ${a.title}: ${a.gap}`));
  return [
    `# Build prompt: TWEB asset map (${version.toUpperCase()}) — NG4-8068 & NG4-8100`,
    "",
    "## Role and goal",
    "You are a senior engineer working in the production Toolbox Web (TWEB) codebase. Bring production in line with the approved map prototype described below: implement every change, run the app, verify each checklist item, then open a pull request titled “NG4-8068 / NG4-8100: map overlap + key → vehicle navigation” that links both tickets.",
    "",
    "## Context",
    `- Product: TWEB lot-management map (Mapbox GL) showing vehicles, key tags${version === "v0" ? "" : ", gateways (key rooms)"} and geofences, with a vehicle list / keys panel on the left and a vehicle details drawer.`,
    `- Tickets: ${JIRA}NG4-8068 (pin overlap) and ${JIRA}NG4-8100 (key → paired vehicle navigation).`,
    `- Approved prototype, the source of truth for behaviour and visuals: ${PROTOTYPE_URL}`,
    `- Prototype source (reference only): ${REPO_URL}`,
    `- Version documented: ${version.toUpperCase()}. This prompt describes the ${version.toUpperCase()} behaviour of the prototype; switch the prototype's version (nav rail) and copy again for another version.${version === "v0" ? " V0 has no gateways / key panel / buckets." : ""}`,
    `- Mocked in the prototype, wire to real data: ${version === "v2" ? "key battery %, room floor level, " : ""}key last-reported time, vehicle specs / CARFAX / safety.`,
    "",
    "## How to apply",
    "1. Find the existing production implementations first (map view and cluster source, vehicle list / keys panel, vehicle details drawer, search). Extend them; don't fork parallel components.",
    "2. Use the exact values in the specs. Where production already has a design token for the same value, use the token.",
    "3. Implement with production components, data/API layer and routing; never copy prototype mock data or demo seeding.",
    "4. Leave behaviour not mentioned here unchanged.",
    "5. Items under “Not approved yet” are out of scope: don't build them; list them in the PR description as follow-ups.",
    "6. When done, walk through the acceptance checklist in the running app and tick each item in the PR description.",
    "",
    "## Components & states",
    ...components(version).flatMap((c) => [`### ${c.title}`, c.detail, ...(c.specs ?? []).map(([a, b]) => `- ${a}: ${b}`), ""]),
    "## Also in this build",
    ...changes(version).flatMap((c) => [`### ${c.title}`, c.detail, ...(c.specs ?? []).map(([a, b]) => `- ${a}: ${b}`), ""]),
    "## Ticket specs",
    "",
    toMarkdown(list),
    "",
    "## Acceptance checklist",
    ...approved,
    ...changes(version).map((c) => `- [ ] ${c.title}`),
    "",
    "## Not approved yet (do not build)",
    ...(open.length ? open : ["- None"]),
    "",
  ].join("\n");
}

function toMarkdown(list: Ticket[]) {
  return list
    .map((t) => {
      const lines = [`## [${t.key}](${JIRA}${t.key}) · ${t.title}`, "", `Blocks ${t.blocks}`, "", `**Objective:** ${t.objective}`];
      if (t.decision) lines.push("", `**Design decision:** ${t.decision}`);
      for (const ac of t.acs) {
        lines.push("", `### ${ac.title}`, "", ac.summary, "", ...ac.design.map((d) => `- ${d}`));
        if (ac.deepDive) {
          const d = ac.deepDive;
          lines.push("", `#### ${d.title}`, "", ...d.steps.map((x, n) => `${n + 1}. ${x}`));
          if (d.bands) lines.push("", "| Zoom | What you see |", "|---|---|", ...d.bands.map(([a, b]) => `| ${a} | ${b} |`));
          if (d.examples) lines.push("", "**Examples**", "", ...d.examples.map((x) => `- ${x}`));
          if (d.code) lines.push("", "```ts", d.code, "```");
        }
        if (ac.specs?.length) lines.push("", "| Spec | Value |", "|---|---|", ...ac.specs.map(([a, b]) => `| ${a} | ${b} |`));
        if (ac.gap) lines.push("", `> **Still open:** ${ac.gap}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function HandoffPanel({ settings, zoom, version, onClose }: { settings: DisplaySettings; zoom: number; version: AppVersion; onClose: () => void }) {
  const list = tickets(settings, version);
  const comps = components(version);
  const [openTickets, setOpenTickets] = useState<Set<string>>(() => new Set([list[0].key]));
  const [openACs, setOpenACs] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);

  const flip = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  return (
    <aside
      aria-label="Engineering handoff"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="absolute right-4 top-[76px] z-30 flex max-h-[calc(100%-290px)] min-h-[260px] w-[420px] flex-col overflow-hidden rounded-[8px] border border-[#dcdcdc] bg-white shadow-[0_12px_32px_rgba(0,0,0,.22)] animate-[pop-in_140ms_ease-out]"
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-[#e8e8e8] px-4 pb-3 pt-3.5">
        <FileCode2 size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold uppercase tracking-[1.4px] text-[#111]">Engineering handoff</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[#666]">
            How the prototype meets each acceptance criterion.
            <span className="rounded-full bg-brand-50 px-2 py-px text-[11.5px] font-semibold text-brand">Documenting {version.toUpperCase()}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(toBuildPrompt(list, version));
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="flex items-center gap-1 rounded-[4px] border border-[#dcdcdc] px-2 py-1 text-[12px] font-semibold text-[#333] hover:bg-[#f4f4f4]"
          title="Copy a build prompt for a coding agent in the production repo: context, specs, how to apply, acceptance checklist"
        >
          {copied ? <Check size={14} className="text-brand" /> : <ClipboardCopy size={14} />}
          {copied ? "Copied" : "Copy build prompt"}
        </button>
        <button type="button" onClick={onClose} aria-label="Dismiss handoff panel" className="grid size-7 place-items-center rounded-full text-[#666] hover:bg-[#eee] hover:text-[#111]">
          <X size={16} strokeWidth={2.5} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7] p-2.5">
        {list.map((t) => {
          const isOpen = openTickets.has(t.key);
          return (
            <section key={t.key} className="mb-2.5 overflow-hidden rounded-[8px] border border-[#dcdcdc] bg-white last:mb-0">
              {/* Ticket accordion */}
              <button
                type="button"
                onClick={() => setOpenTickets((o) => flip(o, t.key))}
                aria-expanded={isOpen}
                className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-[#fafafa] ${isOpen ? "border-b border-[#ececec]" : ""}`}
              >
                <span className="mt-0.5 shrink-0 rounded-[4px] bg-[#e8f1fb] px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-[#0b5cad]">{t.key}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-[#111]">{t.title}</span>
                  <span className="mt-1 block text-[12px] text-[#666]">{t.acs.length} acceptance criteria</span>
                </span>
                <ChevronDown size={18} className={`mt-0.5 shrink-0 text-[#666] transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="px-3.5 pb-3 pt-2.5">
                  <a href={JIRA + t.key} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0b5cad] hover:underline">
                    Open {t.key} in Jira <ExternalLink size={12} />
                  </a>
                  <span className="ml-1.5 text-[12px] text-[#888]">· blocks {t.blocks}</span>

                  <p className="mt-2 text-[13px] leading-snug text-[#333]">
                    <span className="font-semibold text-[#111]">Objective. </span>
                    {t.objective}
                  </p>
                  {t.decision && (
                    <p className="mt-2 rounded-[6px] border-l-[3px] border-brand bg-brand-50 px-2.5 py-2 text-[12.5px] leading-snug text-[#24403a]">
                      <span className="font-semibold">Design decision. </span>
                      {t.decision}
                    </p>
                  )}

                  <h3 className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[1.2px] text-[#8f8f8f]">Acceptance criteria</h3>
                  <ol className="space-y-1.5">
                    {t.acs.map((ac, n) => {
                      const acOpen = openACs.has(ac.id);
                      return (
                        <li key={ac.id} className="rounded-[6px] border border-[#e6e6e6]">
                          <button type="button" onClick={() => setOpenACs((o) => flip(o, ac.id))} aria-expanded={acOpen} className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-[#fafafa]">
                            <span className="mt-px shrink-0 font-mono text-[11px] font-semibold text-[#8f8f8f]">AC{n + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold leading-snug text-[#111]">{ac.title}</span>
                              <span className="mt-0.5 block text-[12px] leading-snug text-[#555]">{ac.summary}</span>
                            </span>
                            <ChevronDown size={14} className={`mt-0.5 shrink-0 text-[#888] transition-transform ${acOpen ? "rotate-180" : ""}`} />
                          </button>

                          {acOpen && (
                            <div className="border-t border-[#f0f0f0] px-2.5 pb-2.5 pt-2">
                              <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#8f8f8f]">How we designed it</p>
                              <ul className="mt-1 list-disc space-y-1 pl-4 text-[12.5px] leading-snug text-[#222] marker:text-[#bbb]">
                                {ac.design.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>

                              {ac.live === "zoom" && <LiveZoom settings={settings} zoom={zoom} />}

                              {ac.deepDive && <DeepDive {...ac.deepDive} />}

                              {ac.specs && (
                                <>
                                  <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[1.1px] text-[#8f8f8f]">Specs</p>
                                  <dl className="mt-1 divide-y divide-[#f0f0f0] rounded-[6px] border border-[#ececec]">
                                    {ac.specs.map(([a, b]) => (
                                      <div key={a} className="grid grid-cols-[118px_1fr] gap-2 px-2 py-1.5">
                                        <dt className="font-mono text-[11px] leading-snug text-[#0B6494]">{a}</dt>
                                        <dd className="text-[12px] leading-snug text-[#222]">{b}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </>
                              )}

                              {ac.gap && (
                                <p className={`mt-2.5 rounded-[6px] px-2.5 py-2 text-[12px] leading-snug ${ac.status === "open" ? "bg-[#fde8e8] text-[#7a1020]" : "bg-[#fdf6e0] text-[#6b5205]"}`}>
                                  <span className="font-semibold">Still open. </span>
                                  {ac.gap}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </section>
          );
        })}

        <ItemsSection key={`components-${version}`} title="Components & states" subtitle={`${comps.length} map and key elements in ${version.toUpperCase()}, every state with its values`} items={comps} />
        <AlsoInBuild version={version} />

        <p className="mt-2.5 px-1 text-[11.5px] leading-snug text-[#888]">
          Prototype notes: {version === "v2" ? "key battery %, room floor level, " : ""}last reported time and vehicle specs / CARFAX / safety are mocked (deterministic from ids). Switch V0 / V1 / V2 at the bottom of the nav rail.
        </p>
      </div>
    </aside>
  );
}

/** Engineer-facing explanation of a mechanism: numbered steps, zoom bands, examples, pseudo-code. */
function DeepDive({ title, steps, bands, examples, code }: NonNullable<AC["deepDive"]>) {
  return (
    <div className="mt-2.5 rounded-[6px] border border-[#cfe0ec] bg-[#f4f9fc] px-2.5 py-2">
      <p className="text-[12.5px] font-semibold text-[#0B4F75]">{title}</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] leading-snug text-[#222] marker:font-semibold marker:text-[#0B6494]">
        {steps.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ol>
      {bands && (
        <>
          <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[1.1px] text-[#5d7d92]">By zoom</p>
          <dl className="mt-1 divide-y divide-[#e3edf4] rounded-[6px] border border-[#dbe7ef] bg-white">
            {bands.map(([a, b]) => (
              <div key={a} className="grid grid-cols-[96px_1fr] gap-2 px-2 py-1.5">
                <dt className="font-mono text-[11px] leading-snug text-[#0B6494]">{a}</dt>
                <dd className="text-[12px] leading-snug text-[#222]">{b}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {examples && (
        <>
          <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[1.1px] text-[#5d7d92]">Examples</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-snug text-[#222] marker:text-[#9bb5c6]">
            {examples.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
      {code && (
        <>
          <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[1.1px] text-[#5d7d92]">Pseudo-code</p>
          <pre className="mt-1 overflow-x-auto rounded-[6px] bg-[#16222b] px-2.5 py-2 font-mono text-[11px] leading-[1.45] text-[#d7e6ef]">{code}</pre>
        </>
      )}
    </div>
  );
}

/** Changes outside the tickets' criteria, collapsed by default. */
function AlsoInBuild({ version }: { version: AppVersion }) {
  const items = changes(version);
  return <ItemsSection key={`changes-${version}`} title="Also in this build" subtitle={`${items.length} changes outside the tickets' criteria`} items={items} />;
}

function ItemsSection({ title, subtitle, items }: { title: string; subtitle: string; items: Change[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-2.5 overflow-hidden rounded-[8px] border border-[#dcdcdc] bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-[#fafafa] ${open ? "border-b border-[#ececec]" : ""}`}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-[#111]">{title}</span>
          <span className="mt-1 block text-[12px] text-[#666]">{subtitle}</span>
        </span>
        <ChevronDown size={18} className={`mt-0.5 shrink-0 text-[#666] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="space-y-2 px-3.5 pb-3 pt-2.5">
          {items.map((c) => (
            <li key={c.title} className="rounded-[6px] border border-[#e6e6e6] px-2.5 py-2">
              <p className="text-[13px] font-semibold text-[#111]">{c.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[#444]">{c.detail}</p>
              {c.specs && (
                <dl className="mt-1.5 divide-y divide-[#f0f0f0] rounded-[6px] border border-[#ececec]">
                  {c.specs.map(([a, b]) => (
                    <div key={a} className="grid grid-cols-[96px_1fr] gap-2 px-2 py-1.5">
                      <dt className="font-mono text-[11px] leading-snug text-[#0B6494]">{a}</dt>
                      <dd className="text-[12px] leading-snug text-[#222]">{b}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Live readout inside the zoom criterion: current zoom against the tier thresholds. */
function LiveZoom({ settings, zoom }: { settings: DisplaySettings; zoom: number }) {
  const tier = zoom >= settings.imageFromZoom ? "Image cards" : zoom < settings.clusterBelowZoom ? "Clusters" : "Map pins";
  const rules =
    zoom >= settings.clusterBelowZoom
      ? "No clustering: every vehicle is drawn individually"
      : "Mapbox 50 px clustering; every asset is in a bubble (lone ones show “1”), no pins";
  return (
    <div className="mt-2.5 rounded-[6px] border border-[#ececec] px-2.5 py-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-[#111]">
          Live · zoom <span className="tabular-nums">{zoom.toFixed(2)}</span>
        </span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand">Showing: {tier}</span>
      </div>
      <TierBar settings={settings} zoom={zoom} />
      <p className="mt-1.5 text-[11.5px] leading-snug text-[#555]">
        <span className="font-semibold text-[#111]">Active rules: </span>
        {rules}
      </p>
    </div>
  );
}

/** Zoom 15–21 strip with the three tiers and a marker for the current zoom. */
function TierBar({ settings, zoom }: { settings: DisplaySettings; zoom: number }) {
  const lo = 15;
  const hi = 21;
  const pct = (z: number) => `${((Math.min(hi, Math.max(lo, z)) - lo) / (hi - lo)) * 100}%`;
  const c = settings.clusterBelowZoom;
  const i = settings.imageFromZoom;
  return (
    <div className="mt-2">
      <div className="relative h-6 overflow-visible rounded-[4px] text-[10.5px] font-semibold">
        <div className="absolute inset-y-0 left-0 flex items-center justify-center rounded-l-[4px] bg-[#e3f1ec] text-[#126550]" style={{ width: pct(c) }}>
          Clusters
        </div>
        <div className="absolute inset-y-0 flex items-center justify-center bg-[#fbefc9] text-[#8a6a06]" style={{ left: pct(c), width: `calc(${pct(i)} - ${pct(c)})` }}>
          Pins
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-[4px] bg-[#d9e8f1] text-[#0B6494]" style={{ left: pct(i) }}>
          Images
        </div>
        <div className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded bg-[#111] transition-[left]" style={{ left: pct(zoom) }} />
      </div>
      <div className="relative mt-1 h-3.5 text-[10px] tabular-nums text-[#888]">
        <span className="absolute left-0">{lo}</span>
        <span className="absolute -translate-x-1/2 font-semibold text-[#111]" style={{ left: pct(c) }}>
          {c}
        </span>
        <span className="absolute -translate-x-1/2 font-semibold text-[#111]" style={{ left: pct(i) }}>
          {i}
        </span>
        <span className="absolute right-0">{hi}</span>
      </div>
    </div>
  );
}
