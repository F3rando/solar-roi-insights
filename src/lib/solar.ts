// Core financial + efficiency model for SolarSense
//
// Data lineage:
// - Zone table (irradiance, heat, utility): curated defaults in code — replace with ETL JSON when ready.
// - When `solarInsights` is passed (from regions.json / Google Solar Building Insights ETL), annual
//   production is scaled by max sun hours vs a San Diego reference so sliders react to real rooftop context.
// - Permit aggregates (adoption, median savings USD) live in API regions.json, not here.

import type { SolarInsightsV1 } from "@/types/api";

export type Zone = {
  id: string;
  name: string;
  // Position on the stylized SD map (percent units 0..100)
  x: number;
  y: number;
  irradiance: number;        // kWh/m²/day
  heatC: number;             // local Scripps heat (°C)
  utilityRate: number;       // $/kWh
};

export const SAN_DIEGO_ZONES: Zone[] = [
  { id: "north-park", name: "North Park",       x: 56, y: 48, irradiance: 5.7, heatC: 31, utilityRate: 0.42 },
  { id: "la-jolla",   name: "La Jolla",         x: 22, y: 38, irradiance: 5.4, heatC: 24, utilityRate: 0.41 },
  { id: "downtown",   name: "Downtown",         x: 48, y: 62, irradiance: 5.5, heatC: 29, utilityRate: 0.43 },
  { id: "el-cajon",   name: "El Cajon",         x: 82, y: 50, irradiance: 6.1, heatC: 34, utilityRate: 0.40 },
  { id: "chula",      name: "Chula Vista",      x: 58, y: 84, irradiance: 5.8, heatC: 28, utilityRate: 0.41 },
  { id: "encinitas",  name: "Encinitas",        x: 30, y: 14, irradiance: 5.6, heatC: 23, utilityRate: 0.40 },
  { id: "mira-mesa",  name: "Mira Mesa",        x: 44, y: 28, irradiance: 5.9, heatC: 27, utilityRate: 0.41 },
  { id: "escondido",  name: "Escondido",        x: 66, y: 10, irradiance: 6.2, heatC: 33, utilityRate: 0.40 },
];

export type Inputs = {
  systemKw: number;          // installed capacity
  investment: number;        // upfront $
  utilityIncreasePct: number;// annual %
};

/** ~Typical strong rooftop annual max sun hours (SD metro) — normalizes Google Building Insights per zone. */
const REF_MAX_SUNSHINE_HOURS_PER_YEAR = 1900;

// Efficiency: -0.4% per °C above 25°C
export function efficiencyPct(heatC: number): number {
  const delta = Math.max(0, heatC - 25);
  return Math.max(50, 100 - delta * 0.4);
}

/** When ETL provides Google Solar sunshine hours, scale baseline production (else 1). Clamped for stability. */
export function googleSunshineScale(insights?: SolarInsightsV1 | null): number {
  const h = insights?.max_sunshine_hours_per_year;
  if (h == null || !Number.isFinite(h) || h <= 0) return 1;
  const raw = h / REF_MAX_SUNSHINE_HOURS_PER_YEAR;
  return Math.min(1.15, Math.max(0.8, raw));
}

// Annual production (kWh) ≈ kW * irradiance * 365 * efficiency × optional Google sunshine calibration
export function annualProductionKwh(zone: Zone, kw: number, insights?: SolarInsightsV1 | null): number {
  const eff = efficiencyPct(zone.heatC) / 100;
  const base = kw * zone.irradiance * 365 * eff * 0.85; // 0.85 system derate
  return base * googleSunshineScale(insights);
}

export function annualSolarSavings(zone: Zone, inputs: Inputs, insights?: SolarInsightsV1 | null): number {
  return annualProductionKwh(zone, inputs.systemKw, insights) * zone.utilityRate;
}

export function paybackYears(zone: Zone, inputs: Inputs, insights?: SolarInsightsV1 | null): number {
  const yearly = annualSolarSavings(zone, inputs, insights);
  if (yearly <= 0) return 99;
  return inputs.investment / yearly;
}

// 25-year cumulative savings with utility inflation (interactive scenario — not an installer quote)
export function projectedSavings(
  zone: Zone,
  inputs: Inputs,
  years = 25,
  insights?: SolarInsightsV1 | null,
): { year: number; solar: number; grid: number }[] {
  const annualKwh = annualProductionKwh(zone, inputs.systemKw, insights);
  const usageKwh = inputs.systemKw * 1400; // approx household usage tied to system size
  const out: { year: number; solar: number; grid: number }[] = [];
  let solarCum = inputs.investment; // start at investment (cost)
  let gridCum = 0;
  for (let y = 0; y <= years; y++) {
    const rate = zone.utilityRate * Math.pow(1 + inputs.utilityIncreasePct / 100, y);
    const gridYear = usageKwh * rate;
    gridCum += gridYear;
    if (y > 0) {
      const solarYear = Math.max(0, (usageKwh - annualKwh) * rate); // residual grid pull
      solarCum += solarYear;
    }
    out.push({ year: y, solar: Math.round(solarCum), grid: Math.round(gridCum) });
  }
  return out;
}

export function cumulativeSavings(
  zone: Zone,
  inputs: Inputs,
  years = 25,
  insights?: SolarInsightsV1 | null,
): number {
  const proj = projectedSavings(zone, inputs, years, insights);
  const last = proj[proj.length - 1];
  return last.grid - last.solar;
}

export function co2AvoidedTons(zone: Zone, inputs: Inputs, years = 25, insights?: SolarInsightsV1 | null): number {
  // EPA: 0.000707 metric tons CO2 per kWh (US grid avg)
  const annualKwh = annualProductionKwh(zone, inputs.systemKw, insights);
  return Math.round(annualKwh * years * 0.000707);
}

export function treesEquivalent(co2Tons: number): number {
  // 1 mature tree absorbs ~0.022 metric tons CO2/yr
  return Math.round(co2Tons / 0.022);
}

export function zoneStatus(zone: Zone, inputs: Inputs, insights?: SolarInsightsV1 | null): {
  label: "High Efficiency Zone" | "Moderate ROI" | "Waste of Money Zone";
  tone: "solar" | "warn" | "heat";
} {
  const yrs = paybackYears(zone, inputs, insights);
  if (yrs < 7) return { label: "High Efficiency Zone", tone: "solar" };
  if (yrs < 12) return { label: "Moderate ROI", tone: "warn" };
  return { label: "Waste of Money Zone", tone: "heat" };
}

export function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}
