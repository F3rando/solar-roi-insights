import { motion } from "framer-motion";
import type { Zone, Inputs } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { GeoMapView } from "@/components/solarsense/GeoMapView";

/**
 * Real basemap (CARTO dark) + 8 zone centroids. Marker color = payback-based priority
 * (zoneStatus) for the current What-If sliders, using `solar_insights` from the API when present.
 */
export function MapView({
  zones,
  selectedId,
  onSelect,
  inputs,
  regionRows,
}: {
  zones: Zone[];
  selectedId: string;
  onSelect: (id: string) => void;
  inputs: Inputs;
  regionRows: RegionRowV1[] | null | undefined;
}) {
  return (
    <div className="relative panel overflow-hidden h-full min-h-[440px]">
      <GeoMapView
        zones={zones}
        inputs={inputs}
        regionRows={regionRows}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      <div className="absolute top-4 left-4 z-[500] flex max-w-[min(100%,18rem)] flex-col gap-1.5 panel px-3 py-2.5 text-xs">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Install priority</div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Color uses the same payback model as the insight panel: your sliders + zone rates, with Google Solar
          sunshine from the API when available. Not a site survey.
        </p>
      </div>

      <div className="absolute top-4 right-4 z-[500] text-right">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Live map</div>
        <div className="text-xs text-muted-foreground">8 centroids · San Diego County</div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 right-4 z-[500] panel px-4 py-3 text-xs space-y-1.5 max-w-[14rem]"
      >
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Scenario tier</div>
        <Legend dot="#4ade80" label="Strong — payback under 7 yr (modeled)" />
        <Legend dot="#facc15" label="Moderate — 7 to 12 yr" />
        <Legend dot="#fb7185" label="Weak — over 12 yr" />
      </motion.div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="size-2.5 rounded-full shrink-0 mt-0.5 border border-border" style={{ backgroundColor: dot }} />
      <span className="text-muted-foreground uppercase tracking-wider text-[10px] leading-snug">{label}</span>
    </div>
  );
}
