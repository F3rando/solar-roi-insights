import { motion } from "framer-motion";
import type { Zone } from "@/lib/solar";
import { efficiencyPct } from "@/lib/solar";

type Layer = "solar" | "heat";

export function MapView({
  zones,
  selectedId,
  onSelect,
  layer,
  onLayerChange,
}: {
  zones: Zone[];
  selectedId: string;
  onSelect: (id: string) => void;
  layer: Layer;
  onLayerChange: (l: Layer) => void;
}) {
  return (
    <div className="relative panel overflow-hidden h-full min-h-[440px]">
      {/* Base grid */}
      <div className="absolute inset-0 grid-bg opacity-60" />

      {/* Layer glows */}
      {zones.map((z) => {
        const intensity =
          layer === "solar"
            ? Math.min(1, (z.irradiance - 5.2) / 1.2)
            : Math.min(1, (z.heatC - 22) / 14);
        const color = layer === "solar" ? "145" : "35";
        return (
          <div
            key={`glow-${z.id}`}
            className="absolute rounded-full pointer-events-none transition-opacity"
            style={{
              left: `${z.x}%`,
              top: `${z.y}%`,
              width: `${180 + intensity * 140}px`,
              height: `${180 + intensity * 140}px`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, oklch(0.75 0.2 ${color} / ${0.18 + intensity * 0.35}), transparent 70%)`,
              filter: "blur(8px)",
            }}
          />
        );
      })}

      {/* San Diego coast silhouette (stylized) */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-25">
        <path
          d="M 5 5 L 35 8 L 40 18 L 28 28 L 30 42 L 18 55 L 22 70 L 38 78 L 45 88 L 65 92 L 80 86 L 92 70 L 95 50 L 90 32 L 78 22 L 70 12 L 60 6 Z"
          fill="none"
          stroke="oklch(0.55 0.04 250)"
          strokeWidth="0.3"
          strokeDasharray="0.6 0.6"
        />
        <text x="50" y="98" textAnchor="middle" fontSize="2.2" fill="oklch(0.55 0.04 250)" letterSpacing="0.5">
          SAN DIEGO COUNTY · 32.7157° N
        </text>
      </svg>

      {/* Zone markers */}
      {zones.map((z) => {
        const selected = z.id === selectedId;
        const eff = efficiencyPct(z.heatC);
        return (
          <button
            key={z.id}
            onClick={() => onSelect(z.id)}
            className="absolute group"
            style={{ left: `${z.x}%`, top: `${z.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <span className="relative block">
              <span
                className={`block rounded-full ring-2 ring-background transition-all ${
                  selected ? "size-4 bg-primary glow-primary" : "size-3 bg-solar/80 group-hover:scale-125"
                }`}
              />
              {selected && (
                <span className="absolute inset-0 pulse-ring rounded-full opacity-60" />
              )}
            </span>
            <span
              className={`absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-[10px] font-mono uppercase tracking-wider transition ${
                selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              }`}
            >
              {z.name} · {eff.toFixed(0)}%
            </span>
          </button>
        );
      })}

      {/* Top-left layer toggle */}
      <div className="absolute top-4 left-4 flex gap-1 panel p-1 rounded-full">
        {(["solar", "heat"] as Layer[]).map((l) => (
          <button
            key={l}
            onClick={() => onLayerChange(l)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition ${
              layer === l
                ? l === "solar"
                  ? "bg-solar text-background"
                  : "bg-heat text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l === "solar" ? "Solar Potential" : "Scripps Heat"}
          </button>
        ))}
      </div>

      {/* Top-right title */}
      <div className="absolute top-4 right-4 text-right">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Live Insight Map</div>
        <div className="text-xs text-muted-foreground">8 zones · Scripps + EIA feed</div>
      </div>

      {/* Bottom-right legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 right-4 panel px-4 py-3 text-xs space-y-1.5"
      >
        <Legend dot="bg-solar" label="High Potential" />
        <Legend dot="bg-warn" label="Moderate ROI" />
        <Legend dot="bg-heat" label="Low Efficiency" />
      </motion.div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</span>
    </div>
  );
}
