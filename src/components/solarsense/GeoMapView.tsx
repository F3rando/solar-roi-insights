import { useEffect, useMemo, useRef, useState } from "react";
import type { Zone, Inputs } from "@/lib/solar";
import { paybackYears, zoneStatus } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { zoneCentroid } from "@/lib/sdZoneCentroids";

import "leaflet/dist/leaflet.css";

const TONE_COLOR: Record<"solar" | "warn" | "heat", string> = {
  solar: "#4ade80",
  warn: "#facc15",
  heat: "#fb7185",
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
      }).setView([32.85, -117.05], 9);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);

      const southWest = L.latLng(32.52, -117.35);
      const northEast = L.latLng(33.35, -116.88);
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
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, [browser]);

  /** Paint markers whenever scenario or API rows change. */
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!browser || !mapReady || !map || !group) return;

    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      group.clearLayers();

      const bounds: import("leaflet").LatLng[] = [];

      for (const z of zones) {
        const row = rowById.get(z.id);
        const ins = row?.solar_insights ?? null;
        const { tone, label } = zoneStatus(z, inputs, ins);
        const { lat, lon } = zoneCentroid(z.id, row?.centroid ?? null);
        bounds.push(L.latLng(lat, lon));

        const pb = paybackYears(z, inputs, ins);
        const fill = TONE_COLOR[tone];
        const selected = z.id === selectedId;

        const circle = L.circleMarker([lat, lon], {
          radius: selected ? 14 : 11,
          color: selected ? "#fafafa" : "#27272a",
          weight: selected ? 3 : 2,
          fillColor: fill,
          fillOpacity: 0.92,
          opacity: 1,
        });

        const sun = row?.solar_insights?.max_sunshine_hours_per_year;
        const adoptionPct = row ? (row.adoption_index * 100).toFixed(0) : "—";

        circle.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:190px;color:#18181b">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px">${z.name}</div>
            <div style="font-size:11px;line-height:1.45;margin:0">
              <strong>Priority:</strong> ${label}<br/>
              <strong>Payback (scenario):</strong> ${pb.toFixed(1)} yr<br/>
              <strong>Permit adoption idx:</strong> ${adoptionPct}%<br/>
              ${sun != null ? `<strong>Google Solar sun:</strong> ${Math.round(sun)} h/yr<br/>` : ""}
            </div>
          </div>
        `);

        circle.on("click", () => {
          onSelectRef.current(z.id);
        });

        circle.addTo(group);
      }

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 11 });
      }

      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
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
      aria-label="San Diego solar priority map"
    />
  );
}
