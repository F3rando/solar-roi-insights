import { FileDown } from "lucide-react";
import { MetricFlipCard } from "@/components/solarsense/MetricFlipCard";
import type { MetricGlossaryKey } from "@/content/metricGlossary";
import type { Zone, Inputs } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import {
  efficiencyPct,
  paybackYears,
  cumulativeSavings,
  fmtUsd,
} from "@/lib/solar";

export function InsightPanel({
  zone,
  inputs,
  apiRegion,
  datasetMedianPaybackYears,
}: {
  zone: Zone;
  inputs: Inputs;
  apiRegion?: RegionRowV1 | null;
  datasetMedianPaybackYears?: number | null;
}) {
  const solarInsights = apiRegion?.solar_insights;
  const eff = efficiencyPct(zone.heatC);
  const payback = paybackYears(zone, inputs, solarInsights);
  const savings = cumulativeSavings(zone, inputs, 25, solarInsights);
  const regionAvg = datasetMedianPaybackYears ?? 7.2;

  return (
    <aside key={zone.id} className="w-full lg:w-[340px] shrink-0 flex flex-col gap-3">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">Insight Engine</div>
        <h2 className="text-lg font-semibold mt-1">{zone.name}, San Diego CA</h2>
      </div>

      <Card label="Solar Payback Period" glossaryKey="insight-payback">
        <div className="text-3xl font-bold text-solar">{payback.toFixed(1)} Years</div>
        <div className="text-xs text-muted-foreground mt-1">Average for region: {regionAvg} years</div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card label="25-Yr Savings" glossaryKey="insight-savings-25yr">
          <div className="text-2xl font-bold">{fmtUsd(savings)}</div>
        </Card>
        <Card label="Efficiency" glossaryKey="insight-efficiency">
          <div className="text-2xl font-bold">{eff.toFixed(0)}%</div>
        </Card>
      </div>

      <Card label="City Heat Adjustment" glossaryKey="insight-urban-heat">
        <div className="text-xl font-semibold">{(zone.heatC * 9 / 5 + 32).toFixed(0)}°F Urban Heat</div>
        <div className="text-xs text-muted-foreground mt-1">Source: Scripps Heat Map Data</div>
      </Card>

      <Card label="Utility Rate (EIA)" glossaryKey="insight-utility-rate">
        <div className="flex items-baseline justify-between">
          <div className="text-xl font-semibold">${zone.utilityRate.toFixed(2)}<span className="text-sm text-muted-foreground">/kWh</span></div>
          <div className="text-xs text-solar">+{inputs.utilityIncreasePct.toFixed(1)}% / yr</div>
        </div>
      </Card>

      {apiRegion && (
        <Card label="Dataset snapshot (ZenPower pipeline)" glossaryKey="insight-zenpower-snapshot">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Adoption index</div>
              <div className="text-lg font-semibold">{(apiRegion.adoption_index * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">YoY growth</div>
              <div className="text-lg font-semibold text-solar">+{apiRegion.yoy_growth_pct.toFixed(1)}%</div>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              Est. median savings / yr: ${apiRegion.median_est_annual_savings_usd.toLocaleString()} · bucket:{" "}
              {apiRegion.install_count_bucket}
            </div>
          </div>
        </Card>
      )}

      {apiRegion?.solar_insights && (
        <Card label="Google Solar (building near zone centroid)" glossaryKey="insight-google-solar">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {apiRegion.solar_insights.max_sunshine_hours_per_year != null && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Max sunshine / yr
                </div>
                <div className="text-lg font-semibold">
                  {Math.round(apiRegion.solar_insights.max_sunshine_hours_per_year)} h
                </div>
              </div>
            )}
            {apiRegion.solar_insights.max_array_panels_count != null && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Est. max panels
                </div>
                <div className="text-lg font-semibold">{apiRegion.solar_insights.max_array_panels_count}</div>
              </div>
            )}
            {apiRegion.solar_insights.carbon_offset_factor_kg_per_mwh != null && (
              <div className="col-span-2 text-xs text-muted-foreground">
                Carbon offset factor: {apiRegion.solar_insights.carbon_offset_factor_kg_per_mwh} kg CO₂ / MWh
                {apiRegion.solar_insights.imagery_quality
                  ? ` · imagery ${apiRegion.solar_insights.imagery_quality}`
                  : ""}
              </div>
            )}
          </div>
        </Card>
      )}

      <button className="mt-2 w-full rounded-xl py-3 font-semibold text-primary-foreground bg-primary hover:opacity-90 transition glow-primary flex items-center justify-center gap-2">
        <FileDown className="size-4" />
        Generate Full PDF Report
      </button>
    </aside>
  );
}

function Card({
  label,
  children,
  glossaryKey,
}: {
  label: string;
  children: React.ReactNode;
  glossaryKey: MetricGlossaryKey;
}) {
  return (
    <MetricFlipCard
      metricKey={glossaryKey}
      className="panel p-4"
      front={
        <>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
          <div className="mt-2">{children}</div>
        </>
      }
    />
  );
}
