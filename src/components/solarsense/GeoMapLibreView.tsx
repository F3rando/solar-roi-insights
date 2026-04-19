import { bbox } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { Zone, Inputs } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { zoneCentroid } from "@/lib/sdZoneCentroids";
import { SAN_DIEGO_COUNTY_OUTLINE } from "@/geo/sanDiegoCountyOutline";
import { clipZoneCellsToCountyLand } from "@/lib/sdCountyLandClip";
import { zoneVoronoiGeoJson } from "@/lib/sdZoneVoronoi";
import {
  buildHeatMetrics,
  heatGradientHex,
  markerRadiusFromScore,
  regionPolygonStyle,
} from "@/lib/mapRelativePriority";
import { maptilerDarkStyleUrl, maptilerTerrainRgbTilesUrl } from "@/lib/maptiler";
import { mapZonePopupHtml } from "@/lib/mapZonePopupHtml";

const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-117.65, 32.48],
  [-116.02, 33.56],
];

type SolarMapData = {
  zones: Zone[];
  inputs: Inputs;
  rowById: Map<string, RegionRowV1>;
  selectedId: string;
};

/**
 * Append-only layer order: each `addLayer` without `beforeId` goes to the **top** of the stack.
 * MapTiler keeps appending layers as tiles/fonts/terrain settle — `moveLayer(id)` pulls ours back up.
 */
const SOLAR_LAYER_STACK: readonly string[] = [
  "county-outline-line",
  "zones-fill",
  "zones-outline",
  "pins-circles",
];

function stackSolarLayersOnTop(map: MlMap) {
  try {
    for (const id of SOLAR_LAYER_STACK) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  } catch {
    /* noop */
  }
}

const STACK_BURST_MS = [0, 50, 150, 400, 1000, 2500, 5000];

function scheduleStackBursts(map: MlMap, isAbort: () => boolean): () => void {
  const timers: number[] = [];
  for (const ms of STACK_BURST_MS) {
    timers.push(
      window.setTimeout(() => {
        if (!isAbort()) {
          stackSolarLayersOnTop(map);
        }
      }, ms),
    );
  }
  return () => {
    for (const t of timers) window.clearTimeout(t);
  };
}

/** (Re)create sources + layers if missing — full style diffs can drop custom layers on cold load. */
function ensureSolarOverlayInstalled(map: MlMap) {
  if (!map.getSource("county-outline")) {
    map.addSource("county-outline", {
      type: "geojson",
      data: SAN_DIEGO_COUNTY_OUTLINE,
    });
  }

  if (!map.getSource("zones")) {
    map.addSource("zones", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      promoteId: "zoneId",
    });
  }

  if (!map.getSource("pins")) {
    map.addSource("pins", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      promoteId: "zoneId",
    });
  }

  if (!map.getLayer("county-outline-line")) {
    map.addLayer({
      id: "county-outline-line",
      type: "line",
      source: "county-outline",
      paint: {
        "line-color": "rgba(250,250,252,0.35)",
        "line-width": 1.65,
      },
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
    });
  }

  if (!map.getLayer("zones-fill")) {
    map.addLayer({
      id: "zones-fill",
      type: "fill",
      source: "zones",
      paint: {
        "fill-color": ["coalesce", ["to-color", ["get", "fillColor"]], "#3B0F70"],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          ["min", 0.38, ["*", ["+", 0.06, ["*", ["get", "score"], 0.12]], 2.05]],
          ["+", 0.06, ["*", ["get", "score"], 0.12]],
        ],
      },
    });
  }

  if (!map.getLayer("zones-outline")) {
    map.addLayer({
      id: "zones-outline",
      type: "line",
      source: "zones",
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          ["to-color", ["get", "hc"]],
          ["to-color", ["get", "sc"]],
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          ["get", "hw"],
          ["get", "sw"],
        ],
        "line-opacity": 1,
      },
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
    });
  }

  if (!map.getLayer("pins-circles")) {
    map.addLayer({
      id: "pins-circles",
      type: "circle",
      source: "pins",
      paint: {
        "circle-radius": ["max", 6, ["to-number", ["get", "r"]]],
        "circle-color": ["coalesce", ["to-color", ["get", "fillColor"]], "#8C2981"],
        "circle-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.92,
          ["to-number", ["get", "fillOpacity"]],
        ],
        "circle-stroke-width": ["to-number", ["get", "strokeWidth"]],
        "circle-stroke-color": ["to-color", ["get", "strokeColor"]],
        "circle-stroke-opacity": 1,
      },
    });
  }
}

function enrichLandFc(
  landFc: FeatureCollection,
  metrics: ReturnType<typeof buildHeatMetrics>,
  selectedId: string,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: landFc.features.map((f) => {
      const id = String(f.properties?.zoneId ?? "");
      const m = metrics.get(id);
      const score = m?.combinedScore ?? 0.5;
      const sel = id === selectedId;
      const stD = regionPolygonStyle(score, sel, "default");
      const stH = regionPolygonStyle(score, sel, "hover");
      return {
        ...f,
        properties: {
          ...f.properties,
          zoneId: id,
          score,
          fillColor: heatGradientHex(score),
          sw: stD.weight,
          sc: stD.color,
          hw: stH.weight,
          hc: stH.color,
        },
      };
    }),
  };
}

/** Push Voronoi + pins GeoJSON — call after every style churn so data is never stuck empty. */
function applySolarDataToMap(map: MlMap, data: SolarMapData) {
  ensureSolarOverlayInstalled(map);

  const zonesSrc = map.getSource("zones") as GeoJSONSource | undefined;
  const pinsSrc = map.getSource("pins") as GeoJSONSource | undefined;
  if (!zonesSrc || !pinsSrc) return;

  const metrics = buildHeatMetrics(data.zones, data.inputs, data.rowById);
  const vorFc = zoneVoronoiGeoJson(data.zones, data.rowById);
  const landFc = clipZoneCellsToCountyLand(vorFc, SAN_DIEGO_COUNTY_OUTLINE);
  const enriched = enrichLandFc(landFc, metrics, data.selectedId);

  zonesSrc.setData(enriched);

  const pinFeatures = data.zones.map((z) => {
    const row = data.rowById.get(z.id);
    const m = metrics.get(z.id)!;
    const { lat, lon } = zoneCentroid(z.id, row?.centroid ?? null);
    const score = m.combinedScore;
    const selected = z.id === data.selectedId;
    const r = Math.min(markerRadiusFromScore(score, selected), 14);
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
      properties: {
        zoneId: z.id,
        r,
        fillColor: heatGradientHex(score),
        strokeColor: selected ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.22)",
        strokeWidth: selected ? 1.75 : 0.85,
        fillOpacity: 0.52,
      },
    };
  });

  pinsSrc.setData({ type: "FeatureCollection", features: pinFeatures });
  stackSolarLayersOnTop(map);
}

export function GeoMapLibreView({
  zones,
  inputs,
  regionRows,
  selectedId,
  onSelect,
}: {
  zones: Zone[];
  inputs: Inputs;
  regionRows: RegionRowV1[] | null | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const initialCountyFitRef = useRef(false);
  const hoveredZoneRef = useRef<string | null>(null);
  const hoveredPinRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupCloseTimerRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const solarDataRef = useRef<SolarMapData>({
    zones,
    inputs,
    rowById: new Map(),
    selectedId,
  });

  const [browser, setBrowser] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setBrowser(true);
  }, []);

  const rowById = useMemo(
    () => new Map((regionRows ?? []).map((r) => [r.id, r])),
    [regionRows],
  );

  solarDataRef.current = { zones, inputs, rowById, selectedId };

  const mapDataRef = useRef({ zones, inputs, rowById });
  mapDataRef.current = { zones, inputs, rowById };

  /** Create MapLibre map once. */
  useEffect(() => {
    if (!browser || !containerRef.current) return;

    let destroyed = false;
    let styleReorderTimer: number | null = null;
    let cancelStackBursts: () => void = () => {};
    const container = containerRef.current;

    const clearPopupTimer = () => {
      if (popupCloseTimerRef.current != null) {
        window.clearTimeout(popupCloseTimerRef.current);
        popupCloseTimerRef.current = null;
      }
    };

    let lastIdleStackAt = 0;

    const restackAfterStyleChange = () => {
      if (destroyed) return;
      ensureSolarOverlayInstalled(map);
      applySolarDataToMap(map, solarDataRef.current);
      stackSolarLayersOnTop(map);
      requestAnimationFrame(() => {
        if (!destroyed) {
          stackSolarLayersOnTop(map);
          applySolarDataToMap(map, solarDataRef.current);
        }
      });
    };

    const scheduleReorderAfterStyleChange = () => {
      if (destroyed) return;
      restackAfterStyleChange();
      if (styleReorderTimer != null) window.clearTimeout(styleReorderTimer);
      styleReorderTimer = window.setTimeout(() => {
        styleReorderTimer = null;
        if (!destroyed) restackAfterStyleChange();
      }, 120);
    };

    const onIdleRestack = () => {
      if (destroyed) return;
      const now = Date.now();
      if (now - lastIdleStackAt < 120) return;
      lastIdleStackAt = now;
      restackAfterStyleChange();
    };

    const map = new maplibregl.Map({
      container,
      style: maptilerDarkStyleUrl(),
      center: [-117.05, 32.85],
      zoom: 9,
      pitch: 52,
      bearing: -17,
      maxBounds: MAX_BOUNDS,
      minZoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

    map.on("load", () => {
      if (destroyed) return;

      try {
        if (!map.getTerrain()) {
          map.addSource("solar-terrain-rgb", {
            type: "raster-dem",
            url: maptilerTerrainRgbTilesUrl(),
            tileSize: 256,
          });
          map.setTerrain({ source: "solar-terrain-rgb", exaggeration: 1.32 });
        }
      } catch {
        /* style may already include terrain */
      }

      ensureSolarOverlayInstalled(map);
      applySolarDataToMap(map, solarDataRef.current);

      stackSolarLayersOnTop(map);
      requestAnimationFrame(() => stackSolarLayersOnTop(map));
      cancelStackBursts = scheduleStackBursts(map, () => destroyed);

      map.on("styledata", scheduleReorderAfterStyleChange);
      map.on("idle", onIdleRestack);
      map.once("idle", () => {
        if (!destroyed) restackAfterStyleChange();
      });

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: "320px",
        className: "map-glass-popup",
      });
      popupRef.current = popup;

      function clearZoneHover() {
        const prev = hoveredZoneRef.current;
        if (prev != null && map.getSource("zones")) {
          try {
            map.setFeatureState({ source: "zones", id: prev }, { hover: false });
          } catch {
            /* ignore */
          }
        }
        hoveredZoneRef.current = null;
      }

      function clearPinHover() {
        const prev = hoveredPinRef.current;
        if (prev != null && map.getSource("pins")) {
          try {
            map.setFeatureState({ source: "pins", id: prev }, { hover: false });
          } catch {
            /* ignore */
          }
        }
        hoveredPinRef.current = null;
      }

      function cancelPopupClose() {
        clearPopupTimer();
      }

      function schedulePopupClose() {
        clearPopupTimer();
        popupCloseTimerRef.current = window.setTimeout(() => {
          popupCloseTimerRef.current = null;
          popup.remove();
          clearPinHover();
        }, 220);
      }

      map.on("mousemove", "zones-fill", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.zoneId != null ? String(f.properties.zoneId) : "";
        if (!id) return;
        if (hoveredZoneRef.current === id) return;
        clearZoneHover();
        hoveredZoneRef.current = id;
        map.setFeatureState({ source: "zones", id }, { hover: true });
      });

      map.on("mouseleave", "zones-fill", () => {
        clearZoneHover();
      });

      map.on("click", "zones-fill", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.zoneId != null ? String(f.properties.zoneId) : "";
        if (id) onSelectRef.current(id);
      });

      map.on("mousemove", "pins-circles", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.zoneId != null ? String(f.properties.zoneId) : "";
        if (!id || !e.lngLat) return;
        if (hoveredPinRef.current === id) return;
        clearPinHover();
        hoveredPinRef.current = id;
        map.setFeatureState({ source: "pins", id }, { hover: true });

        cancelPopupClose();
        const { zones: zList, inputs: inp, rowById: rb } = mapDataRef.current;
        const z = zList.find((x) => x.id === id);
        if (!z) return;
        const row = rb.get(z.id);
        const metrics = buildHeatMetrics(zList, inp, rb);
        const m = metrics.get(z.id)!;
        const n = zList.length;
        const adoptionPct = row ? (row.adoption_index * 100).toFixed(0) : "—";
        const sun = row?.solar_insights?.max_sunshine_hours_per_year;
        popup.setLngLat(e.lngLat).setHTML(mapZonePopupHtml(z.name, m.combinedScore, n, m, adoptionPct, sun)).addTo(map);

        queueMicrotask(() => {
          const el = popup.getElement();
          const wrap = el?.querySelector(".maplibregl-popup-content-wrapper");
          if (!wrap) return;
          const onEnter = () => cancelPopupClose();
          const onLeave = () => schedulePopupClose();
          wrap.addEventListener("mouseenter", onEnter);
          wrap.addEventListener("mouseleave", onLeave);
          popup.once("close", () => {
            wrap.removeEventListener("mouseenter", onEnter);
            wrap.removeEventListener("mouseleave", onLeave);
          });
        });
      });

      map.on("mouseleave", "pins-circles", () => {
        schedulePopupClose();
      });

      map.on("click", "pins-circles", (e) => {
        e.preventDefault();
        const f = e.features?.[0];
        const id = f?.properties?.zoneId != null ? String(f.properties.zoneId) : "";
        if (id) onSelectRef.current(id);
      });

      mapRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => {
        map.resize();
        requestAnimationFrame(() => map.resize());
      });
      window.setTimeout(() => map.resize(), 120);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
      destroyed = true;
      cancelStackBursts();
      if (styleReorderTimer != null) window.clearTimeout(styleReorderTimer);
      map.off("styledata", scheduleReorderAfterStyleChange);
      map.off("idle", onIdleRestack);
      ro.disconnect();
      clearPopupTimer();
      popupRef.current?.remove();
      popupRef.current = null;
      initialCountyFitRef.current = false;
      hoveredZoneRef.current = null;
      hoveredPinRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; data wired in second effect
  }, [browser]);

  /** Sync GeoJSON when metrics / selection change. */
  useEffect(() => {
    const map = mapRef.current;
    if (!browser || !mapReady || !map?.isStyleLoaded()) return;

    applySolarDataToMap(map, solarDataRef.current);

    if (!initialCountyFitRef.current) {
      const box = bbox(SAN_DIEGO_COUNTY_OUTLINE);
      const [minLng, minLat, maxLng, maxLat] = box;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 48, maxZoom: 11, duration: 0 },
      );
      initialCountyFitRef.current = true;
    }

    requestAnimationFrame(() => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
    window.setTimeout(() => map.resize(), 80);

    const t = window.setTimeout(() => {
      applySolarDataToMap(map, solarDataRef.current);
    }, 500);
    return () => window.clearTimeout(t);
  }, [browser, mapReady, zones, inputs, regionRows, selectedId, rowById]);

  if (!browser) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-card/80 text-muted-foreground text-xs font-mono">
        Loading map…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 h-full min-h-0 w-full rounded-[inherit]"
      aria-label="San Diego solar priority regions map (3D terrain)"
    />
  );
}
