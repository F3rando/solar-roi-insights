import type { RegionRowV1, SummaryV1 } from "@/types/api";
import type { Inputs, Zone } from "@/lib/solar";
import {
  paybackYears,
  cumulativeSavings,
  efficiencyPct,
  co2AvoidedTons,
  treesEquivalent,
  zoneStatus,
} from "@/lib/solar";

export type SolarReportFactsPayload = {
  generated_at_utc: string;
  scenario: {
    system_kw: number;
    investment_usd: number;
    utility_escalation_pct_per_year: number;
  };
  data_source_label: string;
  manifest_generated_at: string | null;
  summary: {
    scope_label: string;
    geo_level: string;
    total_estimated_installs: number;
    total_capacity_mw: number;
    median_payback_years: number;
    yoy_growth_pct: number;
    est_co2_avoided_kt_per_year: number;
    regions_count: number;
    last_data_year: number;
    disclaimer?: string;
  } | null;
  regions: Array<{
    region_id: string;
    name: string;
    centroid: { lat: number; lon: number };
    adoption_pct: number;
    yoy_growth_pct: number;
    median_est_annual_savings_usd: number;
    install_count_bucket: string;
    zenpower_solar_insights: {
      max_sunshine_hours_per_year?: number;
      max_array_panels_count?: number;
      carbon_offset_factor_kg_per_mwh?: number;
      imagery_quality?: string;
    } | null;
    modeled: {
      payback_years: number | null;
      savings_25yr_usd: number | null;
      panel_efficiency_pct: number | null;
      co2_25yr_metric_tons: number | null;
      trees_equivalent: number | null;
      roi_band_label: string | null;
    };
    zone_defaults: {
      irradiance_kwh_m2_day: number;
      urban_heat_c: number;
      utility_usd_per_kwh: number;
    } | null;
  }>;
};

function zoneForRegion(zones: Zone[], regionId: string): Zone | undefined {
  return zones.find((z) => z.id === regionId);
}

export function buildSolarReportFactsPayload(
  regions: RegionRowV1[],
  zones: Zone[],
  inputs: Inputs,
  summary: SummaryV1 | null | undefined,
  dataSourceLabel: string,
  manifestGeneratedAt: string | null | undefined,
): SolarReportFactsPayload {
  const sorted = [...regions].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );

  const regionFacts = sorted.map((region) => {
    const z = zoneForRegion(zones, region.id);
    const ins = region.solar_insights;
    if (!z) {
      return {
        region_id: region.id,
        name: region.name,
        centroid: region.centroid,
        adoption_pct: Math.round(region.adoption_index * 1000) / 10,
        yoy_growth_pct: region.yoy_growth_pct,
        median_est_annual_savings_usd: region.median_est_annual_savings_usd,
        install_count_bucket: region.install_count_bucket,
        zenpower_solar_insights: ins
          ? {
              max_sunshine_hours_per_year: ins.max_sunshine_hours_per_year,
              max_array_panels_count: ins.max_array_panels_count,
              carbon_offset_factor_kg_per_mwh: ins.carbon_offset_factor_kg_per_mwh,
              imagery_quality: ins.imagery_quality,
            }
          : null,
        modeled: {
          payback_years: null,
          savings_25yr_usd: null,
          panel_efficiency_pct: null,
          co2_25yr_metric_tons: null,
          trees_equivalent: null,
          roi_band_label: null,
        },
        zone_defaults: null,
      };
    }
    const payback = paybackYears(z, inputs, ins);
    const save = cumulativeSavings(z, inputs, 25, ins);
    const eff = efficiencyPct(z.heatC);
    const co2 = co2AvoidedTons(z, inputs, 25, ins);
    const trees = treesEquivalent(co2);
    const band = zoneStatus(z, inputs, ins).label;
    return {
      region_id: region.id,
      name: region.name,
      centroid: region.centroid,
      adoption_pct: Math.round(region.adoption_index * 1000) / 10,
      yoy_growth_pct: region.yoy_growth_pct,
      median_est_annual_savings_usd: region.median_est_annual_savings_usd,
      install_count_bucket: region.install_count_bucket,
      zenpower_solar_insights: ins
        ? {
            max_sunshine_hours_per_year: ins.max_sunshine_hours_per_year,
            max_array_panels_count: ins.max_array_panels_count,
            carbon_offset_factor_kg_per_mwh: ins.carbon_offset_factor_kg_per_mwh,
            imagery_quality: ins.imagery_quality,
          }
        : null,
      modeled: {
        payback_years: payback >= 99 ? null : Math.round(payback * 10) / 10,
        savings_25yr_usd: Math.round(save),
        panel_efficiency_pct: Math.round(eff * 10) / 10,
        co2_25yr_metric_tons: co2,
        trees_equivalent: trees,
        roi_band_label: band,
      },
      zone_defaults: {
        irradiance_kwh_m2_day: z.irradiance,
        urban_heat_c: z.heatC,
        utility_usd_per_kwh: z.utilityRate,
      },
    };
  });

  return {
    generated_at_utc: new Date().toISOString(),
    scenario: {
      system_kw: Math.round(inputs.systemKw * 10) / 10,
      investment_usd: Math.round(inputs.investment),
      utility_escalation_pct_per_year: Math.round(inputs.utilityIncreasePct * 10) / 10,
    },
    data_source_label: dataSourceLabel,
    manifest_generated_at: manifestGeneratedAt ?? null,
    summary: summary
      ? {
          scope_label: summary.scope.label,
          geo_level: summary.scope.geo_level,
          total_estimated_installs: summary.kpis.total_estimated_installs,
          total_capacity_mw: summary.kpis.total_capacity_mw,
          median_payback_years: summary.kpis.median_payback_years,
          yoy_growth_pct: summary.kpis.yoy_growth_pct,
          est_co2_avoided_kt_per_year: summary.kpis.est_co2_avoided_kt_per_year,
          regions_count: summary.coverage.regions_count,
          last_data_year: summary.coverage.last_data_year,
          disclaimer: summary.disclaimer,
        }
      : null,
    regions: regionFacts,
  };
}
