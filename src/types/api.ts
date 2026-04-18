/** v1 contract — mirrors public/processed/v1/*.json and Lambda responses. */

export type ManifestV1 = {
  version: string;
  schema_version: number;
  generated_at: string;
  dataset_note?: string;
  summary: string;
  regions: string;
};

export type SummaryV1 = {
  scope: {
    label: string;
    geo_level: string;
  };
  kpis: {
    total_estimated_installs: number;
    total_capacity_mw: number;
    median_payback_years: number;
    est_co2_avoided_kt_per_year: number;
    yoy_growth_pct: number;
  };
  coverage: {
    regions_count: number;
    last_data_year: number;
  };
  disclaimer?: string;
};

export type RegionRowV1 = {
  id: string;
  name: string;
  centroid: { lat: number; lon: number };
  adoption_index: number;
  yoy_growth_pct: number;
  median_est_annual_savings_usd: number;
  install_count_bucket: "high" | "medium" | "low";
};

export type RegionsResponseV1 = {
  regions: RegionRowV1[];
};
