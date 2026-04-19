/** Copy for metric glossary dialogs (ZenPower + modeled fields). */

export const METRIC_GLOSSARY = {
  "kpi-installs-est": {
    title: "Installs (est.)",
    source: "ZenPower → summary.json (aggregated)",
    body: [
      "Approximate count of solar-related permits or systems in scope for this dashboard version. The exact definition follows your ETL from ZenPower Records (e.g. filtered geography, active permits, or inferred installs).",
      "Use it as a headline scale indicator for adoption in the selected region or dataset scope—not a census of every rooftop in California.",
    ],
  },
  "kpi-capacity-mw": {
    title: "Total capacity (MW)",
    source: "ZenPower → summary.json (aggregated)",
    body: [
      "Sum of installed or estimated system capacity (kilowatts converted to megawatts) across the same scope as installs. Usually derived from permit or system-size fields in the ZenPower export after cleaning.",
      "Compare cities or time windows once your pipeline publishes those breakdowns; the headline number is dataset-wide for v1.",
    ],
  },
  "kpi-yoy-growth": {
    title: "Year-over-year growth",
    source: "ZenPower → summary.json (aggregated)",
    body: [
      "Percent change between comparable periods (often trailing 12 months vs the prior year, or calendar year vs prior year), computed in the processed bundle from issue or permit dates.",
      "Positive values mean more permits or capacity in the recent window than in the baseline window.",
    ],
  },
  "kpi-co2-summary": {
    title: "CO₂ avoided (kt/yr)",
    source: "ZenPower / model → summary.json",
    body: [
      "Estimated annual CO₂ equivalent avoided if the aggregated solar production in scope displaced grid electricity. The v1 bundle may use a grid emissions factor and assumed capacity factor from your team’s methodology.",
      "Shown in kilotonnes per year (kt/yr) to keep county- or state-scale numbers readable. See Environmental ROI on the dashboard for a household-level illustration using the same physics-style logic.",
    ],
  },
  "insight-payback": {
    title: "Solar payback period",
    source: "Modeled (zone + your inputs)",
    body: [
      "Years until cumulative modeled utility savings meet your upfront investment, for the selected neighborhood zone, system size, and utility rate assumptions.",
      "The “average for region” line compares your payback to a dataset-level median from processed metrics when available; otherwise a placeholder benchmark is shown.",
    ],
  },
  "insight-savings-25yr": {
    title: "25-year savings",
    source: "Modeled (zone + your inputs)",
    body: [
      "Difference between modeled cumulative grid spend and cumulative spend under solar over 25 years, using irradiance, temperature derate, utility rate, and your inflation slider.",
      "This is a household-scale scenario, not a city budget. It answers “how much could this configuration save?” rather than municipal fiscal impact.",
    ],
  },
  "insight-efficiency": {
    title: "Panel efficiency (temperature)",
    source: "Modeled (Scripps heat proxy)",
    body: [
      "Effective performance vs a cool reference: higher urban heat reduces output; we apply a simple derate from local heat (°C) so payback and production stay directionally realistic.",
      "Not a manufacturer datasheet efficiency—it's a climate adjustment on top of irradiance.",
    ],
  },
  "insight-urban-heat": {
    title: "Urban heat (Scripps)",
    source: "Scripps-style neighborhood heat (demo map)",
    body: [
      "Local heat exposure used as a climate stress input for the efficiency adjustment. In production you would bind each zone to a gridded or station-based product.",
      "Displayed in °F for readability; underlying model uses °C.",
    ],
  },
  "insight-utility-rate": {
    title: "Utility rate ($/kWh)",
    source: "EIA-style rate (per zone, demo)",
    body: [
      "Blended retail electricity price used to convert kWh to dollars in the savings model. Your What-If panel’s annual increase percentage compounds this rate each year in the projection.",
      "Rates are illustrative per zone until wired to a live tariff API.",
    ],
  },
  "insight-zenpower-snapshot": {
    title: "Dataset snapshot (ZenPower)",
    source: "ZenPower → regions.json (per zone)",
    body: [
      "Adoption index, YoY growth, median estimated annual savings, and install-count bucket summarize permit activity for the zone that matches the map selection. Definitions are set in your ETL (e.g. index = normalized permit density vs regional mean).",
      "These fields connect the BI aggregate to the neighborhood story on the right rail; they update when you regenerate processed JSON.",
    ],
  },
  "insight-google-solar": {
    title: "Google Solar (roof insights)",
    source: "Google Solar API — building near zone centroid",
    body: [
      "Sunshine hours, estimated max panels, and carbon offset factors are derived from Google’s solar dataset for a representative rooftop near the zone centroid—not a site survey for a specific address.",
      "Imagery quality and modeled fields update with your API or static bundle; use them as directional inputs alongside ZenPower adoption metrics.",
    ],
  },
  "savings-cumulative-25yr": {
    title: "Grid vs solar (25 years)",
    source: "Modeled cumulative costs",
    body: [
      "Compares total money out under two stories: stay on the grid with rising rates vs go solar with upfront cost plus residual grid purchases from the model.",
      "The headline number is grid minus solar cumulative spend at year 25—the same basis as “25-Yr Savings” in the insight column.",
    ],
  },
  "whatif-scenario": {
    title: "What-if scenario",
    source: "User inputs → same ROI model",
    body: [
      "Sliders change system size, upfront cost, and assumed annual utility price escalation. Every downstream number on the page that depends on the model (payback, savings, chart, environmental estimate) updates live.",
      "ZenPower aggregates in the header and region snapshot are not changed by these sliders—they describe the dataset, not your hypothetical install.",
    ],
  },
  "env-environmental-roi": {
    title: "Environmental ROI",
    source: "Modeled from solar production",
    body: [
      "CO₂ avoided uses an EPA-style grid emissions factor times modeled solar kWh over 25 years. Trees equivalent divides that mass by a rough per-tree annual sequestration rate—good for intuition, not forestry inventory.",
      "The badge reflects payback quality bands from the same inputs (high efficiency / moderate / weak ROI) to tie environmental story to financial story.",
    ],
  },
  "map-install-priority": {
    title: "How this map works",
    source: "Install priority · blended score",
    body: [
      "Heat color blends modeled payback (your sliders plus Google Solar sunshine where available) with the permit adoption index — 50/50 — normalized across the eight zones so you’re comparing apples to apples within this dashboard.",
      "Regions are Voronoi tiles from zone centroids, clipped to a simplified San Diego County outline so shading stays on land (not ocean). Boundaries are illustrative service-style partitions, not municipal GIS.",
      "Hover a shaded region to emphasize that zone’s color; click the region to lock the dashboard to that neighborhood. Hover a centroid dot to preview the glass detail card — click the dot or region to apply the same selection.",
    ],
  },
} as const;

export type MetricGlossaryKey = keyof typeof METRIC_GLOSSARY;
