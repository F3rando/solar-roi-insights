import type { Zone, Inputs } from "@/lib/solar";
import { paybackYears } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";

const PAYBACK_WEIGHT = 0.5;
const ADOPTION_WEIGHT = 0.5;

/** Heat ramp: low → mid → high (same order as combined score 0 → 1). */
export const HEAT_COLOR_LOW = "#3B0F70";
export const HEAT_COLOR_MID = "#8C2981";
export const HEAT_COLOR_HIGH = "#FE9F6D";

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function rgbHex(r: number, g: number, b: number): string {
  const c = (x: number) =>
    Math.min(255, Math.max(0, Math.round(x)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const u = Math.max(0, Math.min(1, t));
  return rgbHex(r1 + (r2 - r1) * u, g1 + (g2 - g1) * u, b1 + (b2 - b1) * u);
}

/** CSS `linear-gradient` for legend chips (matches {@link heatGradientHex}). */
export function heatLegendGradientCss(): string {
  return `linear-gradient(90deg, ${HEAT_COLOR_LOW} 0%, ${HEAT_COLOR_MID} 50%, ${HEAT_COLOR_HIGH} 100%)`;
}

/** Rank zones by modeled payback (years), ascending — faster payback = better. */
export function paybackRankings(
  zones: Zone[],
  inputs: Inputs,
  rowById: Map<string, RegionRowV1>,
): Map<string, { payback: number; rankOneBased: number }> {
  const scored = zones.map((z) => {
    const ins = rowById.get(z.id)?.solar_insights ?? null;
    return { id: z.id, payback: paybackYears(z, inputs, ins) };
  });
  scored.sort((a, b) => a.payback - b.payback);

  const out = new Map<string, { payback: number; rankOneBased: number }>();
  scored.forEach((s, i) => {
    out.set(s.id, { payback: s.payback, rankOneBased: i + 1 });
  });
  return out;
}

export type ZoneHeatMetrics = {
  payback: number;
  paybackStrength: number;
  adoptionStrength: number;
  combinedScore: number;
  rankOneBased: number;
};

/** Per-zone metrics: normalize payback & adoption across zones, then blend 50/50 for heat color. */
export function buildHeatMetrics(
  zones: Zone[],
  inputs: Inputs,
  rowById: Map<string, RegionRowV1>,
): Map<string, ZoneHeatMetrics> {
  const rankings = paybackRankings(zones, inputs, rowById);

  const paybacks = zones.map((z) => rankings.get(z.id)!.payback);
  const adoptions = zones.map((z) => rowById.get(z.id)?.adoption_index ?? 0);

  const pbMin = Math.min(...paybacks);
  const pbMax = Math.max(...paybacks);
  const adMin = Math.min(...adoptions);
  const adMax = Math.max(...adoptions);

  const out = new Map<string, ZoneHeatMetrics>();

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const pb = paybacks[i];
    const adop = adoptions[i];

    const pbStr =
      pbMax > pbMin + 1e-9 ? (pbMax - pb) / (pbMax - pbMin) : 0.5;
    const adStr =
      adMax > adMin + 1e-9 ? (adop - adMin) / (adMax - adMin) : 0.5;

    const combined = PAYBACK_WEIGHT * pbStr + ADOPTION_WEIGHT * adStr;

    out.set(z.id, {
      payback: pb,
      paybackStrength: pbStr,
      adoptionStrength: adStr,
      combinedScore: combined,
      rankOneBased: rankings.get(z.id)!.rankOneBased,
    });
  }

  return out;
}

export function heatGradientCss(score: number): string {
  return heatGradientHex(score);
}

/**
 * Purple → magenta → orange ramp for Leaflet / MapLibre (`#rrggbb`).
 */
export function heatGradientHex(score: number): string {
  const s = Math.max(0, Math.min(1, score));
  if (s <= 0.5) {
    return mixHex(HEAT_COLOR_LOW, HEAT_COLOR_MID, s / 0.5);
  }
  return mixHex(HEAT_COLOR_MID, HEAT_COLOR_HIGH, (s - 0.5) / 0.5);
}

/** Softer watercolor fill over the basemap (Voronoi regions). */
export function regionFillOpacity(score: number): number {
  const s = Math.max(0, Math.min(1, score));
  return 0.04 + s * 0.09;
}

/** Quiet boundaries; selected zone keeps a bold ring until another zone is chosen. */
export function regionStrokeColor(score: number, selected: boolean): string {
  if (selected) return "rgba(255, 255, 255, 0.72)";
  const s = Math.max(0, Math.min(1, score));
  // Keep a visible outline on every region; selected stays bold via weight + higher alpha.
  const a = 0.12 + s * 0.12;
  return `rgba(255,255,255,${a})`;
}

export function regionStrokeWeight(selected: boolean): number {
  // Default outlines should read at a glance; selected remains clearly emphasized.
  return selected ? 2 : 0.95;
}

/** Voronoi fills — `hover` boosts opacity/stroke on region hover; selected stays bold when not hovered. */
export function regionPolygonStyle(
  score: number,
  selected: boolean,
  emphasis: "default" | "hover",
): {
  fillColor: string;
  fillOpacity: number;
  color: string;
  weight: number;
  lineJoin: "round";
  lineCap: "round";
} {
  const hover = emphasis === "hover";
  const fillOpacity = hover
    ? Math.min(0.38, regionFillOpacity(score) * 2.05)
    : regionFillOpacity(score);

  let color: string;
  let weight: number;
  if (hover) {
    weight = selected ? 2.35 : 0.78;
    if (selected) {
      color = "rgba(255, 255, 255, 0.92)";
    } else {
      const s = Math.max(0, Math.min(1, score));
      const a = 0.05 + s * 0.1;
      color = `rgba(255,255,255,${a})`;
    }
  } else {
    color = regionStrokeColor(score, selected);
    weight = regionStrokeWeight(selected);
  }

  return {
    fillColor: heatGradientCss(score),
    fillOpacity,
    color,
    weight,
    lineJoin: "round",
    lineCap: "round",
  };
}

export function markerRadiusFromScore(score: number, selected: boolean): number {
  const s = Math.max(0, Math.min(1, score));
  const base = 7 + s * 14;
  return Math.round(selected ? base + 4 : base);
}
