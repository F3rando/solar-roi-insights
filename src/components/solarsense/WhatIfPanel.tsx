import { Slider } from "@/components/ui/slider";
import type { Inputs } from "@/lib/solar";

export function WhatIfPanel({
  inputs,
  onChange,
}: {
  inputs: Inputs;
  onChange: (next: Inputs) => void;
}) {
  return (
    <div className="panel p-5 pb-15 space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">What-If Scenario</div>
        <div className="text-sm mt-1">Tune your install to see live ROI</div>
      </div>

      <SliderRow
        label="System Size"
        value={`${inputs.systemKw.toFixed(1)} kW`}
        slider={
          <Slider
            value={[inputs.systemKw]}
            min={3}
            max={15}
            step={0.5}
            onValueChange={([v]) => onChange({ ...inputs, systemKw: v })}
          />
        }
      />

      <SliderRow
        label="Initial Investment"
        value={`$${(inputs.investment / 1000).toFixed(1)}k`}
        slider={
          <Slider
            value={[inputs.investment]}
            min={8000}
            max={45000}
            step={500}
            onValueChange={([v]) => onChange({ ...inputs, investment: v })}
          />
        }
      />

      <SliderRow
        label="Utility Price Increase"
        value={`${inputs.utilityIncreasePct.toFixed(1)}% / yr`}
        slider={
          <Slider
            value={[inputs.utilityIncreasePct]}
            min={0}
            max={15}
            step={0.1}
            onValueChange={([v]) => onChange({ ...inputs, utilityIncreasePct: v })}
          />
        }
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  slider,
}: {
  label: string;
  value: string;
  slider: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-solar">{value}</span>
      </div>
      {slider}
    </div>
  );
}
