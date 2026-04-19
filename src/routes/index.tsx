import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/solarsense/Sidebar";
import { MapView } from "@/components/solarsense/MapView";
import { InsightPanel } from "@/components/solarsense/InsightPanel";
import { ProjectionChart } from "@/components/solarsense/ProjectionChart";
import { WhatIfPanel } from "@/components/solarsense/WhatIfPanel";
import { EnvROI } from "@/components/solarsense/EnvROI";
import { SavingsHero } from "@/components/solarsense/SavingsHero";
import { SAN_DIEGO_ZONES, type Inputs } from "@/lib/solar";
import { useSolarManifest, useSolarRegions, useSolarSummary } from "@/hooks/useSolarMetrics";
import { useLambdaApi } from "@/lib/api";
import { MetricFlipCard } from "@/components/solarsense/MetricFlipCard";
import type { MetricGlossaryKey } from "@/content/metricGlossary";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SolarSense — Solar ROI Decision Intelligence for San Diego" },
      {
        name: "description",
        content:
          "Bridge Scripps urban-heat data with EIA utility rates to model solar payback, 25-year savings, and environmental ROI across San Diego neighborhoods.",
      },
      { property: "og:title", content: "SolarSense — Solar ROI Decision Intelligence" },
      {
        property: "og:description",
        content:
          "Interactive map + financial dashboard for renewable energy adoption in San Diego.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [selectedId, setSelectedId] = useState("north-park");
  const [inputs, setInputs] = useState<Inputs>({
    systemKw: 7.5,
    investment: 21500,
    utilityIncreasePct: 4.2,
  });

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useSolarSummary();
  const { data: regionsPayload, isLoading: regionsLoading, isError: regionsError } = useSolarRegions();
  const { data: manifest } = useSolarManifest();
  const viaApi = useLambdaApi();

  const zone = useMemo(
    () => SAN_DIEGO_ZONES.find((z) => z.id === selectedId) ?? SAN_DIEGO_ZONES[0],
    [selectedId],
  );

  const apiRegion = useMemo(() => {
    const list = regionsPayload?.regions;
    if (!list?.length) return null;
    return list.find((r) => r.id === selectedId) ?? null;
  }, [regionsPayload, selectedId]);

  return (
    <div className="dark min-h-screen flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 md:p-6 flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">SolarSense</div>
            <h1 className="text-2xl font-bold mt-0.5">
              Decision Intelligence for <span className="gradient-text">Solar ROI</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Link to="/methodology" className="text-primary hover:underline">
                Methodology
              </Link>
              <span>
                Data: {viaApi ? "API (Lambda)" : "static /processed/v1"}
              </span>
            </div>
          </div>
          <SummaryKpis
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
          />
        </header>

        {/* Top: Map + Insight */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 lg:items-stretch">
          <MapView
            zones={SAN_DIEGO_ZONES}
            selectedId={selectedId}
            onSelect={setSelectedId}
            inputs={inputs}
            regionRows={regionsPayload?.regions}
          />
          <InsightPanel
            zone={zone}
            inputs={inputs}
            apiRegion={apiRegion}
            datasetMedianPaybackYears={summary?.kpis.median_payback_years ?? null}
          />
        </section>

        {/* Bottom bento */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SavingsHero zone={zone} inputs={inputs} solarInsights={apiRegion?.solar_insights} />
          <div className="md:col-span-2 lg:col-span-2 row-span-2">
            <ProjectionChart zone={zone} inputs={inputs} solarInsights={apiRegion?.solar_insights} />
          </div>
          <EnvROI zone={zone} inputs={inputs} solarInsights={apiRegion?.solar_insights} />
          <div className="md:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-2">
            <WhatIfPanel inputs={inputs} onChange={setInputs} />
          </div>
          <div className="lg:col-start-4 lg:row-start-2">
            <DataFeedCard
              viaApi={viaApi}
              regionsLoading={regionsLoading}
              regionsError={regionsError}
              manifestGeneratedAt={manifest?.generated_at ?? null}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryKpis({
  summary,
  loading,
  error,
}: {
  summary: ReturnType<typeof useSolarSummary>["data"];
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
        Loading metrics…
      </div>
    );
  }
  if (error || !summary) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        Could not load summary.json — check API URL or static files.
      </div>
    );
  }
  const k = summary.kpis;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-left">
      <Kpi
        label="Installs (est.)"
        value={k.total_estimated_installs.toLocaleString()}
        glossaryKey="kpi-installs-est"
      />
      <Kpi label="Capacity" value={`${k.total_capacity_mw.toFixed(1)} MW`} glossaryKey="kpi-capacity-mw" />
      <Kpi label="YoY growth" value={`+${k.yoy_growth_pct.toFixed(1)}%`} glossaryKey="kpi-yoy-growth" />
      <Kpi
        label="CO₂ avoided"
        value={`${k.est_co2_avoided_kt_per_year.toFixed(0)} kt/yr`}
        glossaryKey="kpi-co2-summary"
      />
    </div>
  );
}

function Kpi({ label, value, glossaryKey }: { label: string; value: string; glossaryKey: MetricGlossaryKey }) {
  return (
    <MetricFlipCard
      metricKey={glossaryKey}
      className="rounded-xl border border-border bg-card/60 px-3 py-2"
      front={
        <>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-sm font-semibold tabular-nums">{value}</div>
        </>
      }
    />
  );
}

function DataFeedCard({
  viaApi,
  regionsLoading,
  regionsError,
  manifestGeneratedAt,
}: {
  viaApi: boolean;
  regionsLoading: boolean;
  regionsError: boolean;
  manifestGeneratedAt: string | null;
}) {
  const metricsStatus = regionsError ? "Error" : regionsLoading ? "Loading" : "Ready";
  const metricsTone = regionsError ? "text-destructive" : regionsLoading ? "text-warn" : "text-solar";
  const rows = [
    { src: "Processed metrics (v1)", status: metricsStatus, tone: metricsTone },
    { src: viaApi ? "API Gateway + Lambda" : "Static /public/processed", status: viaApi ? "API" : "Local", tone: "text-solar" },
    { src: "Scripps Heat Map", status: "Model", tone: "text-warn" },
    { src: "EIA Energy API", status: "Model", tone: "text-warn" },
  ];
  return (
    <div className="panel p-5 h-full">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Data Feeds</div>
      {manifestGeneratedAt && (
        <div className="mt-2 text-[10px] font-mono text-muted-foreground leading-relaxed">
          Snapshot UTC: {manifestGeneratedAt}
        </div>
      )}
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.src} className="flex items-center justify-between gap-2">
            <span className="text-foreground/80">{r.src}</span>
            <span className={`text-xs font-mono uppercase tracking-wider shrink-0 ${r.tone}`}>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
