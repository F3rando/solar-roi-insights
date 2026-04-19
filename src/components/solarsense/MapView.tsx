import { motion } from "framer-motion";
import { useState } from "react";
import type { Zone, Inputs } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { MetricFlipCard } from "@/components/solarsense/MetricFlipCard";
import { GeoMapView } from "@/components/solarsense/GeoMapView";
import { GeoMapLibreView } from "@/components/solarsense/GeoMapLibreView";
import { hasMaptilerKey } from "@/lib/maptiler";
import { heatLegendGradientCss } from "@/lib/mapRelativePriority";

/**
 * MapTiler vector + terrain (MapLibre, tilted 3D) when `VITE_MAPTILER_KEY` is set;
 * otherwise CARTO dark raster basemap (Leaflet).
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
  const [mapKind] = useState<"maplibre" | "leaflet">(() => (hasMaptilerKey() ? "maplibre" : "leaflet"));

  return (
    <div
      className={[
        "relative panel overflow-hidden w-full min-h-[min(70vh,640px)] lg:min-h-[min(72vh,680px)]",
        "rounded-[inherit]",
        "shadow-[0_28px_90px_-32px_rgba(0,0,0,0.65)]",
        "ring-1 ring-white/[0.07]",
      ].join(" ")}
    >
      {mapKind === "maplibre" ? (
        <GeoMapLibreView
          zones={zones}
          inputs={inputs}
          regionRows={regionRows}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <GeoMapView
          zones={zones}
          inputs={inputs}
          regionRows={regionRows}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}

      {/* Inset shadow + highlight — reads “depth” without terrain raster tiles or WebGL */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[100] rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-60px_100px_-40px_rgba(0,0,0,0.45)]"
      />

      <div className="absolute top-4 right-4 z-[500] text-right">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Live map</div>
        <div className="text-xs text-muted-foreground">
          {mapKind === "maplibre"
            ? "MapTiler 3D · terrain · 8 zones"
            : "CARTO 2D — set VITE_MAPTILER_KEY, then restart the dev server"}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 right-4 z-[500] panel px-4 py-3 text-xs max-w-[15rem] space-y-2"
      >
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Priority heat (blended score)
        </div>
        <div
          className="h-2.5 w-full rounded-full border border-border"
          style={{ background: heatLegendGradientCss() }}
          title="Purple = lower blended score in this set, orange = higher"
        />
        <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>Lower</span>
          <span>Higher</span>
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug">
          Regions and dots use the same ramp; clipped to county land for a clean read.
        </p>
      </motion.div>

      <div className="absolute bottom-4 left-4 z-[500]">
        <MetricFlipCard
          metricKey="map-install-priority"
          className="panel flex size-11 items-center justify-center rounded-full border border-border/80 p-0 shadow-md"
          front={
            <span
              className="text-[15px] font-semibold leading-none tabular-nums text-primary"
              aria-hidden
            >
              ?
            </span>
          }
        />
      </div>
    </div>
  );
}
