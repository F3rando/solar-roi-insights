import { bbox } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
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

/** Insert custom layers before the first symbol — fine as a first pass (MapTiler interleaves lines/symbols). */
function firstSymbolLayerId(map: MlMap): string | undefined {
  const layers = map.getStyle().layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (layer.type === "symbol") return layer.id;
  }
  return undefined;
}

/**
 * Pull our layers to the **absolute top** of the stack in order (MapTiler `styledata` / terrain / tiles
 * can inject road & label layers above a “before pins” anchor — heat then vanishes under the basemap).
 * `moveLayer(id)` with no `beforeId` = top; doing county → fill → outline → pins keeps pins above the heat.
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
    /* style swap / hot reload */
  }
}

/** Cold refresh + MapTiler keep injecting layers for seconds — restack on a short schedule. */
const STACK_BURST_MS = [0, 32, 100, 280, 700, 1600, 4000];

function scheduleStackBursts(map: MlMap, isAbort: () => boolean): () => void {
  const timers: number[] = [];
  for (const ms of STACK_BURST_MS) {
    timers.push(
      window.setTimeout(() => {
        if (!isAbort()) stackSolarLayersOnTop(map);
      }, ms),
    );
  }
  return () => {
    for (const t of timers) window.clearTimeout(t);
  };
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

  const [browser, setBrowser] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setBrowser(true);
  }, []);

  const rowById = useMemo(
    () => new Map((regionRows ?? []).map((r) => [r.id, r])),
    [regionRows],
  );

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
    const scheduleReorderAfterStyleChange = () => {
      if (destroyed) return;
      stackSolarLayersOnTop(map);
      requestAnimationFrame(() => stackSolarLayersOnTop(map));
      if (styleReorderTimer != null) window.clearTimeout(styleReorderTimer);
      styleReorderTimer = window.setTimeout(() => {
        styleReorderTimer = null;
        stackSolarLayersOnTop(map);
        requestAnimationFrame(() => stackSolarLayersOnTop(map));
      }, 100);
    };

    const onIdleRestack = () => {
      if (destroyed) return;
      const now = Date.now();
      if (now - lastIdleStackAt < 100) return;
      lastIdleStackAt = now;
      stackSolarLayersOnTop(map);
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

      const beforeId = firstSymbolLayerId(map);

      map.addSource("county-outline", {
        type: "geojson",
        data: SAN_DIEGO_COUNTY_OUTLINE,
      });
      map.addLayer(
        {
          id: "county-outline-line",
          type: "line",
          source: "county-outline",
          paint: {
            "line-color": "rgba(250,250,252,0.3)",
            "line-width": 1.65,
          },
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
        },
        beforeId,
      );

      map.addSource("zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "zoneId",
      });

      map.addLayer(
        {
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: {
            "fill-color": ["to-color", ["get", "fillColor"]],
            /* Matches softened {@link regionFillOpacity} + hover (purple/orange ramp reads without mud). */
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              ["min", 0.34, ["*", ["+", 0.04, ["*", ["get", "score"], 0.09]], 2.05]],
              ["+", 0.04, ["*", ["get", "score"], 0.09]],
            ],
          },
        },
        beforeId,
      );

      map.addLayer(
        {
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
        },
        beforeId,
      );

      map.addSource("pins", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "zoneId",
      });

      /** Last = top of stack: dots above heat + nearly all basemap labels. */
      map.addLayer({
        id: "pins-circles",
        type: "circle",
        source: "pins",
        paint: {
          "circle-radius": ["max", 6, ["to-number", ["get", "r"]]],
          "circle-color": ["to-color", ["get", "fillColor"]],
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

      stackSolarLayersOnTop(map);
      requestAnimationFrame(() => stackSolarLayersOnTop(map));
      cancelStackBursts = scheduleStackBursts(map, () => destroyed);

      map.on("styledata", scheduleReorderAfterStyleChange);
      map.on("idle", onIdleRestack);
      map.once("idle", () => {
        if (!destroyed) {
          stackSolarLayersOnTop(map);
          requestAnimationFrame(() => stackSolarLayersOnTop(map));
        }
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

  /** Voronoi regions, pins, fit bounds — mirrors GeoMapView logic. */
  useEffect(() => {
    const map = mapRef.current;
    if (!browser || !mapReady || !map?.isStyleLoaded()) return;

    const metrics = buildHeatMetrics(zones, inputs, rowById);
    const n = zones.length;

    const vorFc = zoneVoronoiGeoJson(zones, rowById);
    const landFc = clipZoneCellsToCountyLand(vorFc, SAN_DIEGO_COUNTY_OUTLINE);
    const enriched = enrichLandFc(landFc, metrics, selectedId);

    const zonesSrc = map.getSource("zones") as maplibregl.GeoJSONSource | undefined;
    const pinsSrc = map.getSource("pins") as maplibregl.GeoJSONSource | undefined;
    if (!zonesSrc || !pinsSrc) return;

    zonesSrc.setData(enriched);

    const pinFeatures = zones.map((z) => {
      const row = rowById.get(z.id);
      const m = metrics.get(z.id)!;
      const { lat, lon } = zoneCentroid(z.id, row?.centroid ?? null);
      const score = m.combinedScore;
      const selected = z.id === selectedId;
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

    queueMicrotask(() => stackSolarLayersOnTop(map));
    requestAnimationFrame(() => stackSolarLayersOnTop(map));
    const t = window.setTimeout(() => stackSolarLayersOnTop(map), 400);
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
