import { Leaf, TreePine, BadgeCheck } from "lucide-react";
import type { Zone, Inputs } from "@/lib/solar";
import { co2AvoidedTons, treesEquivalent, zoneStatus } from "@/lib/solar";

export function EnvROI({ zone, inputs }: { zone: Zone; inputs: Inputs }) {
  const co2 = co2AvoidedTons(zone, inputs);
  const trees = treesEquivalent(co2);
  const status = zoneStatus(zone, inputs);

  const tone =
    status.tone === "solar"
      ? "bg-solar/15 text-solar border-solar/40"
      : status.tone === "warn"
      ? "bg-warn/15 text-warn border-warn/40"
      : "bg-heat/15 text-heat border-heat/40";

  return (
    <div className="panel p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Environmental ROI</div>
          <div className="text-sm mt-1">25-year projected impact</div>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${tone} flex items-center gap-1`}>
          <BadgeCheck className="size-3" />
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Leaf className="size-4" />} value={`${co2}t`} label="CO₂ Avoided" />
        <Stat icon={<TreePine className="size-4" />} value={trees.toLocaleString()} label="Trees Equivalent" />
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg bg-accent/40 border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-solar">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
