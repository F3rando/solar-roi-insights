import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/solarsense/Sidebar";
import { MapView } from "@/components/solarsense/MapView";
import { InsightPanel } from "@/components/solarsense/InsightPanel";
import { ProjectionChart } from "@/components/solarsense/ProjectionChart";
import { WhatIfPanel } from "@/components/solarsense/WhatIfPanel";
import { EnvROI } from "@/components/solarsense/EnvROI";
import { SavingsHero } from "@/components/solarsense/SavingsHero";
import { SAN_DIEGO_ZONES, type Inputs } from "@/lib/solar";

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
  const [layer, setLayer] = useState<"solar" | "heat">("solar");
  const [inputs, setInputs] = useState<Inputs>({
    systemKw: 7.5,
    investment: 21500,
    utilityIncreasePct: 4.2,
  });

  const zone = useMemo(
    () => SAN_DIEGO_ZONES.find((z) => z.id === selectedId) ?? SAN_DIEGO_ZONES[0],
    [selectedId],
  );

  return (
    <div className="dark min-h-screen flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 md:p-6 flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">SolarSense</div>
            <h1 className="text-2xl font-bold mt-0.5">
              Decision Intelligence for <span className="gradient-text">Solar ROI</span>
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-solar animate-pulse" />
            Live · Scripps + EIA feeds
          </div>
        </header>

        {/* Top: Map + Insight */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <MapView
            zones={SAN_DIEGO_ZONES}
            selectedId={selectedId}
            onSelect={setSelectedId}
            layer={layer}
            onLayerChange={setLayer}
          />
          <InsightPanel zone={zone} inputs={inputs} />
        </section>

        {/* Bottom bento */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SavingsHero zone={zone} inputs={inputs} />
          <div className="md:col-span-2 lg:col-span-2 row-span-2">
            <ProjectionChart zone={zone} inputs={inputs} />
          </div>
          <EnvROI zone={zone} inputs={inputs} />
          <div className="md:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-2">
            <WhatIfPanel inputs={inputs} onChange={setInputs} />
          </div>
          <div className="lg:col-start-4 lg:row-start-2">
            <DataFeedCard />
          </div>
        </section>
      </main>
    </div>
  );
}

function DataFeedCard() {
  const rows = [
    { src: "Scripps Heat Map", status: "Connected", tone: "text-solar" },
    { src: "EIA Energy API", status: "Mock", tone: "text-warn" },
    { src: "Google Maps", status: "Placeholder", tone: "text-muted-foreground" },
  ];
  return (
    <div className="panel p-5 h-full">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Data Feeds</div>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.src} className="flex items-center justify-between">
            <span className="text-foreground/80">{r.src}</span>
            <span className={`text-xs font-mono uppercase tracking-wider ${r.tone}`}>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
