import type { FeatureCollection, Polygon } from "geojson";
import raw from "./san-diego-county.json";

/** Simplified US Census county polygon (FIPS 06073), bundled for Voronoi land clip + map chrome. */
export const SAN_DIEGO_COUNTY_OUTLINE = raw as FeatureCollection<Polygon>;
