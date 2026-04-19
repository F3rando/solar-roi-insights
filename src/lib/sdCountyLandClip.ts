import { featureCollection, intersect } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

/**
 * Intersect each Voronoi cell with the county outline so heat stays on land (no Pacific fill).
 * Outline is a simplified US Census county polygon (not survey-grade cadastral).
 */
export function clipZoneCellsToCountyLand(
  voronoiCells: FeatureCollection<Polygon>,
  countyOutline: FeatureCollection<Polygon | MultiPolygon>,
): FeatureCollection {
  const boundary = countyOutline.features[0];
  if (!boundary) return voronoiCells;

  const out: Feature[] = [];
  for (const cell of voronoiCells.features) {
    let merged: Feature | null = null;
    try {
      merged = intersect(featureCollection([cell, boundary]));
    } catch {
      merged = null;
    }
    if (!merged) continue;
    merged.properties = { ...cell.properties };
    out.push(merged);
  }

  return { type: "FeatureCollection", features: out };
}
