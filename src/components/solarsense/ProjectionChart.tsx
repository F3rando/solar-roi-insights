import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import type { Zone, Inputs } from "@/lib/solar";
import type { SolarInsightsV1 } from "@/types/api";
import { projectedSavings, fmtUsd } from "@/lib/solar";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "5Y", years: 5 },
  { label: "10Y", years: 10 },
  { label: "15Y", years: 15 },
  { label: "MAX", years: 25 },
] as const;

type PeriodYears = (typeof PERIODS)[number]["years"];

type Row = { year: number; solar: number; grid: number; gap: number };

function enrich(rows: { year: number; solar: number; grid: number }[]): Row[] {
  return rows.map((r) => ({
    ...r,
    gap: r.grid - r.solar,
  }));
}

/** First year where cumulative grid spend exceeds cumulative solar spend (if any). */
function crossoverYear(rows: Row[]): number | null {
  for (const r of rows) {
    if (r.year > 0 && r.grid > r.solar) return r.year;
  }
  return null;
}

type TooltipRow = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
  /** Full chart row — Recharts attaches this per series entry. */
  payload?: Row;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const gap = row?.gap;
  return (
    <div
      className="rounded-lg border border-border/80 px-3 py-2 shadow-lg"
      style={{
        background: "oklch(0.205 0.015 250)",
        borderColor: "oklch(0.32 0.02 250)",
        fontSize: 12,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Year {label}
      </div>
      <div className="mt-1 space-y-1 tabular-nums">
        {payload.map((p, i) => (
          <div key={String(p.dataKey ?? i)} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-foreground/90">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium text-foreground">{fmtUsd(Number(p.value))}</span>
          </div>
        ))}
        {gap != null ? (
          <div className="border-t border-border/60 pt-1 mt-1 text-[11px] text-muted-foreground">
            Grid − solar (cumulative gap):{" "}
            <span className="text-foreground font-medium">{fmtUsd(gap)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProjectionChart({
  zone,
  inputs,
  solarInsights,
}: {
  zone: Zone;
  inputs: Inputs;
  solarInsights?: SolarInsightsV1 | null;
}) {
  const fullData = useMemo(
    () => enrich(projectedSavings(zone, inputs, 25, solarInsights)),
    [zone, inputs, solarInsights],
  );

  const [periodMax, setPeriodMax] = useState<PeriodYears>(25);
  const [zoomLo, setZoomLo] = useState(0);
  const [zoomHi, setZoomHi] = useState(25);
  const [showSolar, setShowSolar] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const windowed = useMemo(
    () => fullData.filter((d) => d.year <= periodMax),
    [fullData, periodMax],
  );

  const windowMaxYear = windowed[windowed.length - 1]?.year ?? periodMax;

  useEffect(() => {
    setZoomLo(0);
    setZoomHi(windowMaxYear);
  }, [
    periodMax,
    zone.id,
    inputs.systemKw,
    inputs.investment,
    inputs.utilityIncreasePct,
    windowMaxYear,
  ]);

  useEffect(() => {
    if (zoomHi > windowMaxYear) setZoomHi(windowMaxYear);
    if (zoomLo > zoomHi) setZoomLo(Math.max(0, zoomHi - 1));
    if (zoomLo < 0) setZoomLo(0);
  }, [windowMaxYear, zoomLo, zoomHi]);

  const chartData = useMemo(
    () => windowed.filter((d) => d.year >= zoomLo && d.year <= zoomHi),
    [windowed, zoomLo, zoomHi],
  );

  const cross = useMemo(() => crossoverYear(fullData), [fullData]);
  const showCrossInView = cross != null && cross >= zoomLo && cross <= zoomHi && cross <= periodMax;

  const setPeriod = useCallback((y: PeriodYears) => {
    setPeriodMax(y);
  }, []);

  const onLoSlider = (v: number) => {
    const next = Math.min(v, zoomHi - 1);
    setZoomLo(Math.max(0, next));
  };

  const onHiSlider = (v: number) => {
    const next = Math.max(v, zoomLo + 1);
    setZoomHi(Math.min(windowMaxYear, next));
  };

  const resetView = () => {
    setPeriodMax(25);
    setZoomLo(0);
    setZoomHi(fullData[fullData.length - 1]?.year ?? 25);
    setShowSolar(true);
    setShowGrid(true);
  };

  return (
    <div className="panel p-5 h-full flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Cost projection explorer
          </div>
          <div className="text-sm text-foreground/80 mt-1">
            Cumulative spend: solar vs grid — pick a horizon, then drag zoom (or use sliders).
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 max-w-[320px] leading-snug">
            Model uses your sliders + zone rates; production scales when the dataset includes Google
            Solar sunshine hours.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPeriod(p.years)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] font-semibold font-mono uppercase tracking-wide transition",
                periodMax === p.years
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/80 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-border/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs border-y border-border/50 py-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-border accent-primary"
            checked={showSolar}
            onChange={(e) => setShowSolar(e.target.checked)}
          />
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            Solar pathway
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-border accent-primary"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground" />
            Grid only
          </span>
        </label>
        <span className="text-muted-foreground font-mono text-[10px]">
          View: Y{zoomLo}–Y{zoomHi}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="flex justify-between text-muted-foreground mb-1">
            <span>Zoom start (year)</span>
            <span className="font-mono text-foreground">Y{zoomLo}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, zoomHi - 1)}
            value={zoomLo}
            onChange={(e) => onLoSlider(Number(e.target.value))}
            className="w-full h-1.5 accent-primary cursor-pointer"
          />
        </div>
        <div>
          <div className="flex justify-between text-muted-foreground mb-1">
            <span>Zoom end (year)</span>
            <span className="font-mono text-foreground">Y{zoomHi}</span>
          </div>
          <input
            type="range"
            min={Math.min(windowMaxYear, zoomLo + 1)}
            max={windowMaxYear}
            value={zoomHi}
            onChange={(e) => onHiSlider(Number(e.target.value))}
            className="w-full h-1.5 accent-primary cursor-pointer"
          />
        </div>
      </div>

      {cross != null ? (
        <p className="text-[10px] text-muted-foreground leading-snug">
          <span className="text-foreground/80">
            Crossover (cumulative grid exceeds solar pathway):
          </span>{" "}
          year <span className="font-mono text-primary">{cross}</span> — shown as a vertical guide
          when visible.
        </p>
      ) : null}

      <div className="flex-1 min-h-[220px] pt-1.5">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data in this range — widen the window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="oklch(0.55 0.02 250 / 0.15)" strokeDasharray="3 3" />
              {showCrossInView ? (
                <ReferenceLine
                  x={cross}
                  stroke="oklch(0.75 0.14 145)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "Crossover",
                    position: "top",
                    fill: "oklch(0.72 0.12 145)",
                    fontSize: 10,
                  }}
                />
              ) : null}
              <XAxis
                dataKey="year"
                stroke="oklch(0.68 0.02 250)"
                tickFormatter={(y) => `Y${y}`}
                fontSize={11}
                tickMargin={6}
                domain={["dataMin", "dataMax"]}
              />
              <YAxis
                stroke="oklch(0.68 0.02 250)"
                tickFormatter={(v) => fmtUsd(v)}
                fontSize={11}
                width={52}
                tickMargin={4}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "oklch(0.65 0.04 250)", strokeWidth: 1, strokeDasharray: "4 4" }}
                isAnimationActive={false}
              />
              <Legend wrapperStyle={{ display: "none" }} />
              {showGrid ? (
                <Line
                  type="monotone"
                  dataKey="grid"
                  name="Grid cumulative"
                  stroke="oklch(0.68 0.02 250)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ) : null}
              {showSolar ? (
                <Line
                  type="monotone"
                  dataKey="solar"
                  name="Solar pathway"
                  stroke="oklch(0.7 0.18 250)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, stroke: "oklch(0.85 0.2 250)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
