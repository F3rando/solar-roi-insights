import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { Zone, Inputs } from "@/lib/solar";
import { projectedSavings, fmtUsd } from "@/lib/solar";

export function ProjectionChart({ zone, inputs }: { zone: Zone; inputs: Inputs }) {
  const data = projectedSavings(zone, inputs, 25);

  return (
    <div className="panel p-5 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">25-Year Cost Projection</div>
          <div className="text-sm text-foreground/80 mt-1">Cumulative spend: solar vs grid</div>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Solar</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground" /> Grid</span>
        </div>
      </div>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="oklch(0.55 0.02 250 / 0.15)" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              stroke="oklch(0.68 0.02 250)"
              tickFormatter={(y) => `Y${y}`}
              fontSize={11}
            />
            <YAxis
              stroke="oklch(0.68 0.02 250)"
              tickFormatter={(v) => fmtUsd(v)}
              fontSize={11}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.205 0.015 250)",
                border: "1px solid oklch(0.28 0.018 250)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [fmtUsd(Number(v)), ""] as [string, string]}
              labelFormatter={(l) => `Year ${l}`}
            />
            <Legend wrapperStyle={{ display: "none" }} />
            <Line type="monotone" dataKey="grid" stroke="oklch(0.68 0.02 250)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="solar" stroke="oklch(0.7 0.18 250)" strokeWidth={2.5} dot={{ r: 3, fill: "oklch(0.7 0.18 250)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
