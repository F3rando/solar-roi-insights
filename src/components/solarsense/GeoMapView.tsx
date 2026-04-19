import { useEffect, useMemo, useRef, useState } from "react";
import type { Zone, Inputs } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { zoneCentroid } from "@/lib/sdZoneCentroids";
import { SAN_DIEGO_COUNTY_OUTLINE } from "@/geo/sanDiegoCountyOutline";
import { clipZoneCellsToCountyLand } from "@/lib/sdCountyLandClip";
import { zoneVoronoiGeoJson } from "@/lib/sdZoneVoronoi";
import {
  buildHeatMetrics,
  heatGradientCss,
  markerRadiusFromScore,
  regionPolygonStyle,
} from "@/lib/mapRelativePriority";
import { mapZonePopupHtml } from "@/lib/mapZonePopupHtml";

import "leaflet/dist/leaflet.css";

const POPUP_OPTS = {
  className: "map-glass-popup",
  maxWidth: 320,
  closeButton: true,
  autoPanPadding: [16, 16] as [number, number],
};

export function GeoMapView({
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
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const groupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const initialCountyFitRef = useRef(false);
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

  /** Create map once (client-only). */
  useEffect(() => {
    if (!browser || !containerRef.current) return;

    let destroyed = false;

    (async () => {
      const L = await import("leaflet");
      if (destroyed || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: false,
      }).setView([32.85, -117.05], 9);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);

      const southWest = L.latLng(32.48, -117.65);
      const northEast = L.latLng(33.56, -116.02);
      map.setMaxBounds(L.latLngBounds(southWest, northEast));
      map.setMinZoom(8);

      mapRef.current = map;
      groupRef.current = group;
      setMapReady(true);

      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      destroyed = true;
      setMapReady(false);
      initialCountyFitRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, [browser]);

  /** Voronoi regions + centroid pins. */
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!browser || !mapReady || !map || !group) return;

    let cancelled = false;
    const clearPinTimers: Array<() => void> = [];

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      group.clearLayers();

      const metrics = buildHeatMetrics(zones, inputs, rowById);
      const n = zones.length;

      const vorFc = zoneVoronoiGeoJson(zones, rowById);
      const landFc = clipZoneCellsToCountyLand(vorFc, SAN_DIEGO_COUNTY_OUTLINE);

      const outline = L.geoJSON(SAN_DIEGO_COUNTY_OUTLINE, {
        interactive: false,
        style: {
          fillOpacity: 0,
          opacity: 1,
          weight: 1.65,
          color: "rgba(250,250,252,0.3)",
          lineJoin: "round",
          lineCap: "round",
        },
      });
      outline.addTo(group);

      const geoLayer = L.geoJSON(landFc, {
        style: (feat) => {
          const id = String(feat?.properties?.zoneId ?? "");
          const m = metrics.get(id);
          const score = m?.combinedScore ?? 0.5;
          const sel = id === selectedId;
          return regionPolygonStyle(score, sel, "default");
        },
        onEachFeature: (feat, layer) => {
          const id = String(feat.properties?.zoneId ?? "");
          layer.on("click", () => {
            onSelectRef.current(id);
          });
        },
      });
      geoLayer.addTo(group);

      function leafPathsForGeoLayer(ly: import("leaflet").Layer): import("leaflet").Path[] {
        if (ly instanceof L.Polygon || ly instanceof L.Rectangle) {
          return [ly as import("leaflet").Path];
        }
        if (ly instanceof L.LayerGroup) {
          const acc: import("leaflet").Path[] = [];
          ly.eachLayer((child) => {
            acc.push(...leafPathsForGeoLayer(child));
          });
          return acc;
        }
        return [];
      }

      const regionLayersById = new Map<string, import("leaflet").Path[]>();

      const setRegionEmphasis = (zoneId: string, emphasis: "default" | "hover") => {
        const layers = regionLayersById.get(zoneId);
        if (!layers?.length) return;
        const mm = metrics.get(zoneId);
        const sc = mm?.combinedScore ?? 0.5;
        const sel = zoneId === selectedId;
        const st = regionPolygonStyle(sc, sel, emphasis);
        for (const lyr of layers) lyr.setStyle(st);
      };

      geoLayer.eachLayer((layer) => {
        const feat = (layer as import("leaflet").Layer & { feature?: GeoJSON.Feature }).feature;
        const id = String(feat?.properties?.zoneId ?? "");
        if (!id) return;

        const paths = leafPathsForGeoLayer(layer);
        if (!paths.length) return;
        regionLayersById.set(id, paths);

        for (const path of paths) {
          path.on("mouseover", () => setRegionEmphasis(id, "hover"));
          path.on("mouseout", () => setRegionEmphasis(id, "default"));
        }
      });

      for (const z of zones) {
        const row = rowById.get(z.id);
        const m = metrics.get(z.id)!;
        const { lat, lon } = zoneCentroid(z.id, row?.centroid ?? null);

        const score = m.combinedScore;
        const fill = heatGradientCss(score);
        const selected = z.id === selectedId;
        const rpx = markerRadiusFromScore(score, selected);

        const name = z.name;
        const sun = row?.solar_insights?.max_sunshine_hours_per_year;
        const adoptionPct = row ? (row.adoption_index * 100).toFixed(0) : "—";

        const pinBase = {
          radius: Math.min(rpx, 11),
          color: selected ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.22)",
          weight: selected ? 1.75 : 0.85,
          fillColor: fill,
          fillOpacity: 0.52,
          opacity: 1,
        };

        const pin = L.circleMarker([lat, lon], {
          ...pinBase,
          interactive: true,
          bubblingMouseEvents: false,
          pane: "markerPane",
        });
        pin.bindPopup(mapZonePopupHtml(name, score, n, m, adoptionPct, sun), POPUP_OPTS);

        const resetPin = () => {
          pin.setStyle(pinBase);
        };
        const hoverPin = () => {
          pin.setStyle({
            ...pinBase,
            fillOpacity: 0.82,
            weight: selected ? 2 : 1.05,
            color: selected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.38)",
          });
        };

        let popupCloseTimer: number | null = null;
        const cancelPinPopupClose = () => {
          if (popupCloseTimer != null) {
            window.clearTimeout(popupCloseTimer);
            popupCloseTimer = null;
          }
        };
        clearPinTimers.push(cancelPinPopupClose);
        const schedulePinPopupClose = () => {
          cancelPinPopupClose();
          popupCloseTimer = window.setTimeout(() => {
            popupCloseTimer = null;
            pin.closePopup();
            resetPin();
          }, 220);
        };

        pin.on("popupopen", () => {
          queueMicrotask(() => {
            const pu = pin.getPopup();
            const el = pu?.getElement();
            const wrap = el?.querySelector(".leaflet-popup-content-wrapper");
            if (!wrap) return;
            const onEnter = () => cancelPinPopupClose();
            const onLeave = () => schedulePinPopupClose();
            wrap.addEventListener("mouseenter", onEnter);
            wrap.addEventListener("mouseleave", onLeave);
            pin.once("popupclose", () => {
              wrap.removeEventListener("mouseenter", onEnter);
              wrap.removeEventListener("mouseleave", onLeave);
            });
          });
        });

        pin.on("mouseover", () => {
          cancelPinPopupClose();
          hoverPin();
          pin.openPopup();
        });
        pin.on("mouseout", () => {
          schedulePinPopupClose();
        });
        pin.on("popupclose", () => {
          cancelPinPopupClose();
          resetPin();
        });
        pin.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(z.id);
        });

        pin.addTo(group);
      }

      if (!initialCountyFitRef.current) {
        map.fitBounds(outline.getBounds(), { padding: [48, 48], maxZoom: 11 });
        initialCountyFitRef.current = true;
      }

      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
      for (const t of clearPinTimers) t();
    };
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
      className="absolute inset-0 z-0 min-h-[400px] rounded-[inherit]"
      aria-label="San Diego solar priority regions map"
    />
  );
}
