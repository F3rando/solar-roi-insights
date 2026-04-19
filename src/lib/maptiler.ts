/**
 * MapTiler keys and URL builders for MapLibre GL “3D” maps (terrain pitch + hillshade).
 *
 * Sign up at https://www.maptiler.com/cloud/ → create a key → set in `.env.local`:
 *   VITE_MAPTILER_KEY=your_key
 *
 * Install in the app: `maplibre-gl` (and optionally `@vis.gl/react-maplibre` / `react-map-gl`).
 * This file does not render a map; it centralizes URLs so GeoMapView (or a new MapLibre
 * component) can share one pattern.
 */

const KEY =
  typeof import.meta !== "undefined" ? (import.meta.env.VITE_MAPTILER_KEY ?? "") : "";

export function hasMaptilerKey(): boolean {
  return Boolean(KEY);
}

/** Light vector style (streets). */
export function maptilerStreetsStyleUrl(key: string = KEY): string {
  return `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key)}`;
}

/** Dark vector style — closest match to CARTO dark / app dark chrome. */
export function maptilerDarkStyleUrl(key: string = KEY): string {
  return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${encodeURIComponent(key)}`;
}

/** High-res DEM for `terrain` and `hillshade` in MapLibre. */
export function maptilerTerrainRgbTilesUrl(key: string = KEY): string {
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${encodeURIComponent(key)}`;
}
