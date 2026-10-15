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

function tickets(s: DisplaySettings, version: AppVersion): Ticket[] {
  const c = s.clusterBelowZoom;
  const i = s.imageFromZoom;
  return [
    {
      key: "NG4-8068",
      title: "Pin overlap behavior across vehicle, key, cluster & geofence pins",
      blocks: "NG4-7766 (A-029), NG4-7762 (A-006)",
      objective: "One UX pattern for pins that share or nearly share a coordinate: cars parked bumper-to-bumper, hundreds of key tags in one key box.",
      decision:
        "Resolve overlap with zoom + aggregation, not by spreading pins on click. Dense vehicles stay a cluster until street zoom; keys in one key box collapse into a single gateway that opens a list. Spider / fan-out was prototyped and dropped: small targets, and it breaks down at high counts.",
      acs: [
        {
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
        {
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
        {
          id: "8068-3",
          title: "Zoom-level adaptability",
          status: "covered",
          summary: `Clusters below ${c} · pins ${c}–${i} · image cards from ${i}.`,
          design: [
            "Far out, nearby vehicles merge into clusters so the lot reads as density.",
            `Below ${c}, clusters and pins appear side by side on purpose: only dense rows (≥ ${s.clusterMinPoints} cars chained within ${s.groupDistance} m) become a count bubble; cars parked apart stay pins.`,
            `From ${c} every vehicle is its own pin; from ${i} pins become photo cards.`,
            "Keys in rooms collapse into gateways from zoom 16.",
          ],
          deepDive: {
            title: "How clustering decides: cluster or pin at the same zoom",
            steps: [
              `Two rules stack. Rule A (ours) groups by real-world distance and runs below zoom ${c}. Rule B (Mapbox) merges by screen distance and runs only below zoom ${Math.max(0, Math.floor(c - 1)) + 1}.`,
              `Rule A, linking: any two vehicles ${s.groupDistance} m or less apart are linked, and links chain: if A–B and B–C are each ≤ ${s.groupDistance} m, A, B and C are one group even when A–C is further. (Single-linkage via a ${s.groupDistance} m spatial-hash grid + union-find, O(n).)`,
              `Rule A, deciding: a group with ≥ ${s.clusterMinPoints} vehicles is sent to the map as ONE cluster feature at the group's centroid, weight = vehicle count. A group with fewer than ${s.clusterMinPoints} is sent as individual pins.`,
              `Rule A is in metres, so groups don't change as you zoom between ${Math.max(0, Math.floor(c - 1)) + 1} and ${c}. They are recomputed when the zoom crosses ${c}, when data changes, and when the map stops moving.`,
              `Rule B: the Mapbox GeoJSON source has cluster: true, clusterRadius 50 px, clusterMaxZoom ${Math.max(0, Math.floor(c - 1))}. Below zoom ${Math.max(0, Math.floor(c - 1)) + 1} it merges any features within 50 px (pins and Rule A bubbles alike) and sums their weight, so the far-out view stays tidy.`,
              `At zoom ${c} Rule A switches off and every vehicle is sent as a pin; the cluster layers have maxzoom ${c}, so no bubble can leak past it.`,
              `Clicking a bubble: Rule A group → frame its vehicles at zoom ≥ ${(c + 0.05).toFixed(2)} so they separate into pins. Rule B cluster → zoom to getClusterExpansionZoom() + 0.25.`,
            ],
            bands: [
              [`zoom < ${Math.max(0, Math.floor(c - 1)) + 1}`, `Rule A + Rule B → mostly bubbles; a lone car far from others is still a pin`],
              [`${Math.max(0, Math.floor(c - 1)) + 1} – ${c}`, `Rule A only → bubbles for dense rows, pins for everything else (the mixed view)`],
              [`${c} – ${i}`, "No grouping → every vehicle is a pin"],
              [`≥ ${i}`, "Every vehicle is an image card"],
            ],
            examples: [
              `6 cars in a row, 2.75 m apart → one chained group of 6 ≥ ${s.clusterMinPoints} → bubble “6” until ${c}.`,
              `2 cars side by side, 3 m apart → group of 2 < ${s.clusterMinPoints} → two pins, even at zoom 18.2.`,
              `1 car parked alone → group of 1 → pin at every zoom.`,
              `4 cars + 3 cars, 12 m apart → no link between the rows → 4 pins + 3 pins (each row < ${s.clusterMinPoints}).`,
            ],
            code: `// below clusterBelowZoom (${c})
groups = groupByDistance(vehicles, ${s.groupDistance} /* m */)
for (g of groups)
  g.length >= ${s.clusterMinPoints}
    ? emit({ cluster, at: centroid(g), weight: g.length })
    : g.forEach(emitPin)
// at or above ${c}: vehicles.forEach(emitPin)

// mapbox source (merges on top, far out only)
{ cluster: true, clusterRadius: 50,
  clusterMaxZoom: ${Math.max(0, Math.floor(c - 1))},
  clusterProperties: { weight: ["+", ["get", "weight"]] } }`,
          },
          specs: [
            [`zoom < ${c}`, "Clusters (count bubble) for dense groups"],
            [`${c} ≤ zoom < ${i}`, "Map marker pins, coloured by inventory age"],
            [`zoom ≥ ${i}`, "Image cards, bottom-centre anchored"],
            ["Far-out tidy-up", `Mapbox clustering radius 50 px up to zoom ${Math.max(0, Math.floor(c - 1))} (clusterMaxZoom must be an integer)`],
            ["Bubble", "Count = summed weight; radius 15 px (< 100), 18 px (100–999), 22 px (≥ 1000)"],
          ],
          live: "zoom",
        },
        {
          id: "8068-4",
          title: "States & micro-interactions",
          status: "partial",
          summary: "Hover, selected and expanded/collapsed are built; keyboard focus is not.",
          design: [
            "Hover: tooltip card above the marker plus a soft halo; still works on dimmed markers.",
            "Selected: the vehicle always renders as its image card (any zoom) with its 1–2 key tags; everything else drops to 50%.",
            "Expanded / collapsed: a gateway opens into its key panel + tags and closes with ✕ or Esc. Hovering a key fades the other tags to 50%.",
          ],
          specs: [
            ["Selected camera", "fitBounds(vehicle + keys), padding T150 B60 L460 R90, maxZoom 19.5"],
            ["asset-pins", "icon-opacity 1 → 0.5"],
            ["clusters", "circle-opacity, circle-stroke-opacity 1 → 0.5"],
            ["cluster-count", "text-opacity 1 → 0.5"],
            ["cluster-shadow", "circle-opacity 0.22 → 0.11"],
            ["Image cards", "opacity 0.5 on the card inside the marker (.is-dim > *); Mapbox sets inline opacity on the marker element"],
          ],
          gap: "Keyboard focus ring for pins and key tags isn't defined yet (gateways have one).",
        },
      ],
    },
    {
      key: "NG4-8100",
      title: "Navigation from key-only map view to paired vehicle details (A-033)",
      blocks: "NG4-7768 (A-033), NG4-6631, NG4-8167",
      objective: "From any key, reach the vehicle it belongs to in one click, without memorising details or switching to the Inventory view.",
      decision: "Clicking a key takes you back to the Vehicles list with the paired vehicle's details drawer open, on the same map: no page change, and the map shows the car with its keys.",
      acs: [
        {
          id: "8100-1",
          title: "Key Detail Card / Popup: paired vehicle summary",
          status: "partial",
          summary: "Key panel rows and the key detail card show the vehicle; the map key tooltip doesn't yet.",
          design: [
            "Each row in the key panel shows the Key ID with the vehicle's Year Make Model and condition underneath.",
            `Hovering a row opens the Key Details card: ${version === "v1" ? "key, room, status" : "key, room · floor, status, battery, last reported"}, then the paired vehicle's photo, VIN • stock and condition • price.`,
          ],
          specs: [
            ["Key panel", "450 px wide, left 16 / top 76 / bottom 16, radius 6, shadow 0 8 28 rgba(0,0,0,.28)"],
            ["Row", "Key ID 16 px semibold; vehicle line 14 px #666 + condition colour; last reported 12 px #8F8F8F"],
            ["Detail card", "300 px, radius 8, beside the panel (left 476 px), aligned to the hovered row"],
            ["Version", version === "v1" ? "V1 (showing): room names, no photos or floor level, no battery; hover card drops battery & last reported" : "V2 (showing): room · floor level, battery ≥20% green / <20% red; V1 drops both"],
          ],
          gap: "The tooltip on a key tag on the map shows Key ID, last reported and address, but no vehicle. Add a Year Make Model + VIN line.",
        },
        {
          id: "8100-2",
          title: "Prominent CTA to the vehicle",
          status: "covered",
          summary: "The vehicle title is the link; Key IDs and key tags are links too.",
          design: [
            "Vehicle line in a key row: opens the vehicle's details and frames it with its keys.",
            "Key ID (row or hover): opens the paired vehicle's details but centres the map on that key, for when you're walking to the key.",
            "Clicking a key tag on the map opens its vehicle.",
          ],
          specs: [
            ["Link style", "Hover underline; Key ID hover colour #007CBE"],
          ],
        },
        {
          id: "8100-3",
          title: "Navigation & transition behavior",
          status: "covered",
          summary: "Back to the Vehicles list, vehicle details drawer open, same map.",
          design: [
            "The key panel closes, the list switches from Keys to Vehicles, and the Vehicle Detail drawer opens on the left over the map. Filters stay as they were.",
            "The selected vehicle switches to its image card with its 1–2 key tags, and everything else dims to 50%.",
            "Closing the drawer leaves you in the Vehicles view; the Keys tab reopens the gateway list.",
          ],
          specs: [
            ["Drawer", "400 px wide, left 16 / top 76 / bottom 16, radius 6, z-40"],
            ["Drawer content", "Gallery · title + price/miles · actions · INFO / TRIPS · Location (lot + each key) · Basics (all Key IDs) · Specs · CARFAX · Safety"],
            ["Camera", "Vehicle link: fitBounds(vehicle + keys). Key ID: flyTo(key)"],
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
            "The vehicle link isn't rendered, so there's nothing to click into.",
          ],
          gap: "The demo data has no unpaired keys, so the state can't be seen live yet.",
        },
        {
          id: "8100-5",
          title: "Consistency with TWEB drawers & popovers",
          status: "covered",
          summary: "Key panel, vehicle drawer and map cards share one set of rules.",
          design: [
            "Key panel and vehicle drawer use the same placement, radius and shadow.",
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
    },
  ];
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
          <p className="mt-0.5 text-[13px] text-[#666]">How the prototype meets each acceptance criterion.</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`# Asset map: engineering handoff\n\n${toMarkdown(list)}\n`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="flex items-center gap-1 rounded-[4px] border border-[#dcdcdc] px-2 py-1 text-[12px] font-semibold text-[#333] hover:bg-[#f4f4f4]"
          title="Copy both tickets as Markdown"
        >
          {copied ? <Check size={14} className="text-brand" /> : <ClipboardCopy size={14} />}
          {copied ? "Copied" : "Copy"}
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

        <p className="mt-2.5 px-1 text-[11.5px] leading-snug text-[#888]">
          Prototype notes: key battery %, last reported time and vehicle specs / CARFAX / safety are mocked (deterministic from ids). Switch V1 / V2 at the bottom of the nav rail.
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

/** Live readout inside the zoom criterion: current zoom against the tier thresholds. */
function LiveZoom({ settings, zoom }: { settings: DisplaySettings; zoom: number }) {
  const tier = zoom >= settings.imageFromZoom ? "Image cards" : zoom < settings.clusterBelowZoom ? "Clusters + pins" : "Map pins";
  const pixelMergeBelow = Math.max(0, Math.floor(settings.clusterBelowZoom - 1)) + 1;
  const rules =
    zoom >= settings.clusterBelowZoom
      ? "No grouping: every vehicle is drawn individually"
      : zoom < pixelMergeBelow
        ? `Rule A (≥ ${settings.clusterMinPoints} within ${settings.groupDistance} m) + Rule B (Mapbox 50 px merge)`
        : `Rule A only (≥ ${settings.clusterMinPoints} within ${settings.groupDistance} m); Mapbox merge is off`;
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
