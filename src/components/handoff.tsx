"use client";

import { useState } from "react";
import { Check, ChevronDown, ClipboardCopy, FileCode2, X } from "lucide-react";

import type { AppVersion, DisplaySettings } from "@/lib/types";

/**
 * Engineering handoff: the behaviour and specs this prototype implements, shown on top
 * of the map so an engineer can poke at the live thing while reading the rules.
 * Values come from the running settings where they exist, so the panel never drifts
 * from what the map actually does.
 */

type Row = [label: string, value: string];
type Status = "covered" | "partial" | "open";
interface Criterion {
  /** Requirement as the ticket words it. */
  req: string;
  status: Status;
  /** How the prototype answers it (or what's missing). */
  how: string;
}
interface Ticket {
  key: string;
  title: string;
  /** Stories this design ticket unblocks. */
  blocks: string;
}
interface Section {
  id: string;
  title: string;
  ticket?: Ticket;
  intro?: string;
  criteria?: Criterion[];
  rows: Row[];
  notes?: string[];
}

const JIRA = "https://ikongps.atlassian.net/browse/";

function sections(s: DisplaySettings, version: AppVersion): Section[] {
  const c = s.clusterBelowZoom;
  const i = s.imageFromZoom;
  return [
    {
      id: "overlap",
      title: "Pin overlap behavior",
      ticket: { key: "NG4-8068", title: "Define pin overlap behavior across vehicle, key, cluster, and geofence pins", blocks: "NG4-7766 (A-029), NG4-7762 (A-006)" },
      intro:
        "Decision: resolve overlap by zoom + aggregation, not by spreading pins on click. Dense vehicles stay a cluster until street zoom; keys in one key box collapse into a single gateway that opens a list. Spider / fan-out was prototyped and dropped (hard to target, breaks at high counts).",
      criteria: [
        {
          req: "1. Universal interaction pattern",
          status: "covered",
          how: "Same model for every pin type: count marker (cluster or gateway) → click → expand (zoom in for vehicles, key panel + tags for gateways). Click priority: cluster › pin › geofence. Geofences sit below all pins and have no tooltip, so they never block a pin.",
        },
        {
          req: "2. High-density / worst case (500+ keys at one key box)",
          status: "partial",
          how: "Gateway marker shows the count; the key panel list (scroll + stock-type filter) is the source of truth. Tested with 104 keys in one gateway. Open: at 500+, on-map tags would cover ~1,000 px — propose capping tags (e.g. 150) with “+N more in list”.",
        },
        {
          req: "3. Zoom-level adaptability",
          status: "covered",
          how: `Clusters below ${c}, pins ${c}–${i}, image cards from ${i}; dense groups (≥ ${s.clusterMinPoints} within ${s.groupDistance} m) stay clustered until ${c}; gateways from zoom 16. See Zoom tiers.`,
        },
        {
          req: "4. States & micro-interactions",
          status: "partial",
          how: "Hover (tooltip + halo), selected (image card, rest at 50%), expanded/collapsed (gateway panel open/closed) are built — see Selected state. Open: keyboard focus ring for pins/tags not yet defined.",
        },
      ],
      rows: [],
    },
    {
      id: "zoom",
      title: "Zoom tiers: cluster → pin → image",
      intro: "Supports NG4-8068 §3. Thresholds are inclusive at the lower bound.",
      rows: [
        [`zoom < ${c}`, "Clusters (count bubble) for dense groups; isolated vehicles already show as pins"],
        [`${c} ≤ zoom < ${i}`, "Map marker pins (Figma pin, coloured by inventory age)"],
        [`zoom ≥ ${i}`, "Image cards (vehicle photo marker, bottom-centre anchored)"],
        ["Density rule (below " + c + ")", `Vehicles within ${s.groupDistance} m of each other (single-linkage) stay a cluster when the group has ≥ ${s.clusterMinPoints} vehicles`],
        ["Cluster click", `Frames the cluster's vehicles at zoom ≥ ${c} so they open up as pins`],
        ["Far-out tidy-up", "Mapbox pixel clustering, radius 50 px, up to zoom " + Math.max(0, Math.floor(c - 1)) + " (clusterMaxZoom must be an integer)"],
        ["Gateways", "From zoom 16 (Keys view), keys stored in a room collapse into that room's gateway marker"],
        ["Selected vehicle", "Always an image card, at every zoom tier"],
      ],
    },
    {
      id: "focus",
      title: "Selected state: focus & dimming",
      intro: "Supports NG4-8068 §4. Selecting a vehicle (list, map, key panel) focuses it; everything else drops to 50% opacity but stays hoverable.",
      rows: [
        ["Selected vehicle", "Image card, active state, drawn above the map layers"],
        ["Paired keys", "Its 1–2 key tags shown at their real positions, full opacity"],
        ["Camera", "fitBounds(vehicle + its keys), padding T150 B60 L460 R90 (shrinks on narrow maps), maxZoom 19.5"],
        ["asset-pins (symbol)", "icon-opacity 1 → 0.5"],
        ["clusters (circle)", "circle-opacity 1 → 0.5, circle-stroke-opacity 1 → 0.5"],
        ["cluster-count (symbol)", "text-opacity 1 → 0.5"],
        ["cluster-shadow (circle)", "circle-opacity 0.22 → 0.11"],
        ["Image cards (HTML markers)", "CSS opacity 1 → 0.5 (.is-dim)"],
        ["Hover", "Tooltips still open on dimmed markers"],
        ["Expanded gateway", "Same dimming while a gateway or In Lot / Off Lot bucket is open; hovering a key fades the other tags to 50%"],
      ],
    },
    {
      id: "keynav",
      title: "Key → paired vehicle navigation",
      ticket: { key: "NG4-8100", title: "Define navigation path from key-only map view to paired vehicle details (A-033)", blocks: "NG4-7768 (A-033), NG4-6631, NG4-8167" },
      intro: "From any key (gateway list, key tag on the map) the user reaches the paired vehicle in one click, without leaving the map.",
      criteria: [
        {
          req: "1a. Paired vehicle summary in the slide-out detail panel",
          status: "covered",
          how: "Key panel row shows Year Make Model + condition; hovering a row opens the Key Details card with vehicle photo, VIN • stock, condition • price.",
        },
        {
          req: "1b. Paired vehicle summary in the key map popup",
          status: "open",
          how: "Map key-tag tooltip shows Key ID, battery, last reported, address — not the vehicle yet. Add Year Make Model + VIN line.",
        },
        {
          req: "1c. Prominent CTA / clickable vehicle title",
          status: "covered",
          how: "Vehicle line in each row is a link (hover underline). Key ID is also a link. Clicking a key tag on the map opens its vehicle.",
        },
        {
          req: "2. Navigation & transition model",
          status: "covered",
          how: "Opens the Vehicle Detail side drawer (400 px) over the current map — no page change. Vehicle link: frame vehicle + its keys. Key ID link: open vehicle, centre map on the key.",
        },
        {
          req: "3. Empty / Unpaired state",
          status: "partial",
          how: "Row reads “Unpaired key”, card reads “Not paired to a vehicle.” and the vehicle CTA is hidden. Demo data has no unpaired keys yet, so it can't be shown live.",
        },
        {
          req: "4. Consistency with TWEB drawers & popovers",
          status: "covered",
          how: "Key panel and vehicle drawer share size rules (left 16 / top 76, radius 6, same shadow), Barlow type scale, link style #007CBE on hover.",
        },
      ],
      rows: [],
    },
    {
      id: "rooms",
      title: "Gateways (key rooms) & key tags",
      rows: [
        ["Click gateway", `Opens the key panel, flies to zoom ≥ ${Math.max(18.6, c)} with +233 px x-offset (clears the panel), dims the map`],
        ["Key tag layout", "Scattered around the gateway: sunflower spiral, avg spacing 42 px, min centre distance 41 px, 52 px clear ring around the gateway"],
        ["Key tag size", "Figma Key Marker at 85% (27 px tag); fill #17A5E6, 2 px border #336C8B, radius 4, shadow 0 4 4 rgba(0,0,0,.25)"],
        ["Hover row or tag", "Hovered tag full opacity, all other tags 50%"],
        ["In Lot / Off Lot", "Keys not in a room: inside the geofence → In Lot, outside → Off Lot (point-in-polygon); tags drawn at real positions"],
      ],
    },
    {
      id: "keypanel",
      title: "Key panel",
      rows: [
        ["Container", "450 px wide, left 16 / top 76 / bottom 16, radius 6, shadow 0 8 28 rgba(0,0,0,.28), z-40"],
        ["Version", version === "v1" ? "V1 (showing): rooms named by gateway ID (GW-40121…), no photos, no edit" : "V2 (showing): named rooms with photos; V1 = gateway IDs, no photos, no edit"],
        ["Header (V2)", "200 px place photo; pencil (top-left) uploads a new photo (downscaled to 1000 px JPEG q0.82)"],
        ["Title", "24 px semibold + Online / Offline badge; key count 18 px #666"],
        ["Filter", "All Stock Types dropdown (New / Preowned …)"],
        ["Row", "Key ID 16 px semibold · battery icon + % · last reported 12 px #8F8F8F; vehicle line 14 px #666 + condition colour"],
        ["Battery", "≥ 20% green #126550, < 20% red #B10F2E"],
        ["Hover card", "300 px, 8 px radius, beside the panel (left 476): key, room, status, Battery, Last reported, paired vehicle photo / VIN / price"],
      ],
    },
    {
      id: "vehicle",
      title: "Vehicle details drawer",
      rows: [
        ["Container", "400 px wide, left 16 / top 76 / bottom 16, radius 6, z-40"],
        ["Sections", "Photo gallery · title + price/miles · actions (Featured, Remark, Send Brochure, Share Location, More) · INFO / TRIPS"],
        ["Location", "Lot row + one row per paired key (room, last update), each with a locate button"],
        ["Info", "Basics (incl. every Key ID), Specifications, CARFAX, Safety ratings"],
      ],
    },
    {
      id: "tokens",
      title: "Tokens & data",
      rows: [
        ["Inventory age", "0–45 days #00B397 · 46–90 #E6B117 · 90+ #E50C0C"],
        ["Geofence", "#0B6494 fill at 30%, 2 px white stroke"],
        ["Type", "Barlow (UI), Saira (brand headings)"],
        ["Key ↔ vehicle", "key.vehicleId → vehicle.id; key.hubId → gateway; 1–2 keys per vehicle"],
        ["Mocked in prototype", "Key battery %, last reported time, vehicle specs/CARFAX/safety (deterministic from ids)"],
      ],
    },
  ];
}

const STATUS_LABEL: Record<Status, string> = { covered: "Covered", partial: "Partial", open: "Open" };

function toMarkdown(list: Section[]) {
  return list
    .map((sec) => {
      const lines = [`## ${sec.ticket ? `[${sec.ticket.key}](${JIRA}${sec.ticket.key}) · ` : ""}${sec.title}`];
      if (sec.ticket) lines.push("", `_${sec.ticket.title}_ — blocks ${sec.ticket.blocks}`);
      if (sec.intro) lines.push("", sec.intro);
      if (sec.criteria?.length) lines.push("", "| Requirement | Status | Prototype |", "|---|---|---|", ...sec.criteria.map((k) => `| ${k.req} | ${STATUS_LABEL[k.status]} | ${k.how} |`));
      if (sec.rows.length) lines.push("", "| | |", "|---|---|", ...sec.rows.map(([a, b]) => `| ${a} | ${b} |`));
      if (sec.notes) lines.push("", ...sec.notes.map((n) => `- ${n}`));
      return lines.join("\n");
    })
    .join("\n\n");
}

export function HandoffPanel({ settings, zoom, version, onClose }: { settings: DisplaySettings; zoom: number; version: AppVersion; onClose: () => void }) {
  const list = sections(settings, version);
  const [open, setOpen] = useState<Set<string>>(() => new Set(["overlap", "keynav"]));
  const [copied, setCopied] = useState(false);
  const tier = zoom >= settings.imageFromZoom ? "Image cards" : zoom < settings.clusterBelowZoom ? "Clusters" : "Map pins";

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <aside
      aria-label="Engineering handoff"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="absolute right-[72px] top-[76px] z-30 flex max-h-[calc(100%-290px)] min-h-[260px] w-[400px] flex-col overflow-hidden rounded-[8px] border border-[#dcdcdc] bg-white shadow-[0_12px_32px_rgba(0,0,0,.22)] animate-[pop-in_140ms_ease-out]"
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-[#e8e8e8] px-4 pb-3 pt-3.5">
        <FileCode2 size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold uppercase tracking-[1.4px] text-[#111]">Engineering handoff</h2>
          <p className="mt-0.5 text-[13px] text-[#666]">How this prototype answers NG4-8068 & NG4-8100, plus build specs.</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`# Asset map: engineering handoff (NG4-8068, NG4-8100)\n\n${toMarkdown(list)}\n`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="flex items-center gap-1 rounded-[4px] border border-[#dcdcdc] px-2 py-1 text-[12px] font-semibold text-[#333] hover:bg-[#f4f4f4]"
          title="Copy all specs as Markdown"
        >
          {copied ? <Check size={14} className="text-brand" /> : <ClipboardCopy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onClose} aria-label="Dismiss handoff panel" className="grid size-7 place-items-center rounded-full text-[#666] hover:bg-[#eee] hover:text-[#111]">
          <X size={16} strokeWidth={2.5} />
        </button>
      </header>

      {/* Ticket coverage at a glance, for PMs. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#e8e8e8] px-4 py-2 text-[12px] text-[#555]">
        <span className="font-semibold text-[#111]">Ticket coverage</span>
        {(["covered", "partial", "open"] as Status[]).map((st) => (
          <span key={st} className="flex items-center gap-1">
            <StatusChip status={st} />
            {list.flatMap((x) => x.criteria ?? []).filter((k) => k.status === st).length}
          </span>
        ))}
      </div>

      {/* Live: where the map is right now against the thresholds. */}
      <div className="shrink-0 border-b border-[#e8e8e8] px-4 py-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-[#111]">
            Zoom <span className="tabular-nums">{zoom.toFixed(2)}</span>
          </span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand">Showing: {tier}</span>
        </div>
        <TierBar settings={settings} zoom={zoom} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.map((sec) => {
          const isOpen = open.has(sec.id);
          return (
            <section key={sec.id} className="border-b border-[#eee] last:border-b-0">
              <button type="button" onClick={() => toggle(sec.id)} aria-expanded={isOpen} className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#f7f7f7]">
                {sec.ticket && <span className="shrink-0 rounded-[4px] bg-[#e8f1fb] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0b5cad]">{sec.ticket.key}</span>}
                <span className="flex-1 text-[14px] font-semibold text-[#111]">{sec.title}</span>
                <ChevronDown size={16} className={`text-[#666] transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-3">
                  {sec.ticket && (
                    <p className="mb-2 text-[12px] leading-snug text-[#666]">
                      <a href={JIRA + sec.ticket.key} target="_blank" rel="noreferrer" className="font-semibold text-[#0b5cad] hover:underline">
                        {sec.ticket.key}
                      </a>{" "}
                      {sec.ticket.title} · blocks {sec.ticket.blocks}
                    </p>
                  )}
                  {sec.intro && <p className="mb-2 text-[13px] leading-snug text-[#555]">{sec.intro}</p>}
                  {sec.criteria && (
                    <ul className="mb-1 space-y-1.5">
                      {sec.criteria.map((k) => (
                        <li key={k.req} className="rounded-[6px] border border-[#ececec] px-2.5 py-2">
                          <div className="flex items-start gap-2">
                            <span className="flex-1 text-[12.5px] font-semibold leading-snug text-[#111]">{k.req}</span>
                            <StatusChip status={k.status} />
                          </div>
                          <p className="mt-1 text-[12px] leading-snug text-[#444]">{k.how}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {sec.rows.length > 0 && (
                  <dl className="divide-y divide-[#f0f0f0] rounded-[6px] border border-[#ececec]">
                    {sec.rows.map(([a, b]) => (
                      <div key={a} className="grid grid-cols-[132px_1fr] gap-2 px-2.5 py-1.5">
                        <dt className="font-mono text-[11.5px] leading-snug text-[#0B6494]">{a}</dt>
                        <dd className="text-[12.5px] leading-snug text-[#222]">{b}</dd>
                      </div>
                    ))}
                  </dl>
                  )}
                  {sec.notes?.map((n) => (
                    <p key={n} className="mt-2 text-[12px] text-[#666]">
                      {n}
                    </p>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function StatusChip({ status }: { status: Status }) {
  const cls = status === "covered" ? "bg-[#e3f5ef] text-[#126550]" : status === "partial" ? "bg-[#fbefc9] text-[#8a6a06]" : "bg-[#fde8e8] text-[#B10F2E]";
  return <span className={`shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.6px] ${cls}`}>{STATUS_LABEL[status]}</span>;
}

/** Zoom 15–21 strip with the three tiers and a live marker for the current zoom. */
function TierBar({ settings, zoom }: { settings: DisplaySettings; zoom: number }) {
  const lo = 15;
  const hi = 21;
  const pct = (z: number) => `${((Math.min(hi, Math.max(lo, z)) - lo) / (hi - lo)) * 100}%`;
  const c = settings.clusterBelowZoom;
  const i = settings.imageFromZoom;
  return (
    <div className="mt-2.5">
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
