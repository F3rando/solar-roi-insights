import { MetricFlipCard } from "@/components/solarsense/MetricFlipCard";
import type { Zone, Inputs } from "@/lib/solar";
import type { SolarInsightsV1 } from "@/types/api";
import { annualProductionKwh, annualSolarSavings, cumulativeSavings, paybackYears, projectedSavings, fmtUsd } from "@/lib/solar";

export function SavingsHero({
  zone,
  inputs,
  solarInsights,
}: {
  zone: Zone;
  inputs: Inputs;
  solarInsights?: SolarInsightsV1 | null;
}) {
  const total = cumulativeSavings(zone, inputs, 25, solarInsights);
  const proj = projectedSavings(zone, inputs, 25, solarInsights);
  const last = proj[proj.length - 1];
  const annualKwh = Math.round(annualProductionKwh(zone, inputs.systemKw, solarInsights));
  const annualUsd = Math.round(annualSolarSavings(zone, inputs, solarInsights));
  const payback = paybackYears(zone, inputs, solarInsights);
  const crossover =
    proj.find((r) => r.year > 0 && r.grid > r.solar)?.year ?? null;

  return (
    <MetricFlipCard
      metricKey="savings-cumulative-25yr"
      className="panel p-5"
      front={
        <>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Grid vs Solar Savings</div>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <div className="text-3xl font-bold text-solar">{fmtUsd(total)}</div>
            <span className="text-xs text-muted-foreground">saved over 25 years</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-primary" /> Solar: {fmtUsd(last.solar)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-muted-foreground" /> Grid: {fmtUsd(last.grid)}
            </span>
          </div>

          <div className="mt-4 border-t border-border/60 pt-4 grid grid-cols-2 gap-3 text-xs">
            <MiniStat label="Est. production" value={`${annualKwh.toLocaleString()} kWh/yr`} />
            <MiniStat label="Est. savings" value={`${fmtUsd(annualUsd)}/yr`} />
            <MiniStat label="Payback" value={`${payback.toFixed(1)} yrs`} />
            <MiniStat label="Crossover" value={crossover != null ? `Y${crossover}` : "—"} />
          </div>
        </>
      }
    />
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-accent/30 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold text-foreground/90 tabular-nums">{value}</div>
    </div>
  );
}
