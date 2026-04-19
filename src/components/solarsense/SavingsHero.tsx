import type { Zone, Inputs } from "@/lib/solar";
import type { SolarInsightsV1 } from "@/types/api";
import { cumulativeSavings, projectedSavings, fmtUsd } from "@/lib/solar";

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

  return (
    <div className="panel p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Grid vs Solar Savings</div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <div className="text-3xl font-bold text-solar">{fmtUsd(total)}</div>
        <span className="text-xs text-muted-foreground">saved over 25 years</span>
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" /> Solar: {fmtUsd(last.solar)}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted-foreground" /> Grid: {fmtUsd(last.grid)}</span>
      </div>
    </div>
  );
}
