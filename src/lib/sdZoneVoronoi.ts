import { featureCollection, point, voronoi } from "@turf/turf";
import type { FeatureCollection, Polygon } from "geojson";
import type { Zone } from "@/lib/solar";
import type { RegionRowV1 } from "@/types/api";
import { zoneCentroid } from "@/lib/sdZoneCentroids";

/**
 * West, south, east, north — must fully contain the San Diego County outline before clipping,
 * so Voronoi tiles reach the county edge (inland + coast). Padded outside Census bbox.
 */
export const SD_COUNTY_VORONOI_BBOX: [number, number, number, number] = [
  -117.62, 32.5, -116.04, 33.53,
];

/**
 * Voronoi partition from zone seeds: organic boundaries between regions (not legal city limits).
 * Cells align 1:1 with `zones` order so each polygon gets the right heat color.
 */
export function zoneVoronoiGeoJson(
  zones: Zone[],
  rowById: Map<string, RegionRowV1>,
): FeatureCollection<Polygon> {
  const pts = featureCollection(
    zones.map((z) => {
      const { lat, lon } = zoneCentroid(z.id, rowById.get(z.id)?.centroid ?? null);
      return point([lon, lat], { zoneId: z.id, name: z.name });
    }),
  );

  const raw = voronoi(pts, { bbox: SD_COUNTY_VORONOI_BBOX });

  raw.features.forEach((f, i) => {
    const z = zones[i];
    if (z) {
      f.properties = { ...f.properties, zoneId: z.id, name: z.name };
    }
  });

  return raw as FeatureCollection<Polygon>;
}
