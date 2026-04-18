import { motion } from "framer-motion";
import { FileDown } from "lucide-react";
import type { Zone, Inputs } from "@/lib/solar";
import {
  efficiencyPct,
  paybackYears,
  cumulativeSavings,
  fmtUsd,
} from "@/lib/solar";

export function InsightPanel({ zone, inputs }: { zone: Zone; inputs: Inputs }) {
  const eff = efficiencyPct(zone.heatC);
  const payback = paybackYears(zone, inputs);
  const savings = cumulativeSavings(zone, inputs);
  const regionAvg = 7.2;

  return (
    <motion.aside
      key={zone.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full lg:w-[340px] shrink-0 flex flex-col gap-3"
    >
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">Insight Engine</div>
        <h2 className="text-lg font-semibold mt-1">{zone.name}, San Diego CA</h2>
      </div>

      <Card label="Solar Payback Period">
        <div className="text-3xl font-bold text-solar">{payback.toFixed(1)} Years</div>
        <div className="text-xs text-muted-foreground mt-1">Average for region: {regionAvg} years</div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card label="25-Yr Savings">
          <div className="text-2xl font-bold">{fmtUsd(savings)}</div>
        </Card>
        <Card label="Efficiency">
          <div className="text-2xl font-bold">{eff.toFixed(0)}%</div>
        </Card>
      </div>

      <Card label="City Heat Adjustment">
        <div className="text-xl font-semibold">{(zone.heatC * 9 / 5 + 32).toFixed(0)}°F Urban Heat</div>
        <div className="text-xs text-muted-foreground mt-1">Source: Scripps Heat Map Data</div>
      </Card>

      <Card label="Utility Rate (EIA)">
        <div className="flex items-baseline justify-between">
          <div className="text-xl font-semibold">${zone.utilityRate.toFixed(2)}<span className="text-sm text-muted-foreground">/kWh</span></div>
          <div className="text-xs text-solar">+{inputs.utilityIncreasePct.toFixed(1)}% / yr</div>
        </div>
      </Card>

      <button className="mt-2 w-full rounded-xl py-3 font-semibold text-primary-foreground bg-primary hover:opacity-90 transition glow-primary flex items-center justify-center gap-2">
        <FileDown className="size-4" />
        Generate Full PDF Report
      </button>
    </motion.aside>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
