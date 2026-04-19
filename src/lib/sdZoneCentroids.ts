/**
 * WGS84 centroids for the 8 dashboard zones (matches data/notebooks/sd_zones.py).
 * Used as map fallbacks when API / regions.json is not loaded.
 */
export const SD_ZONE_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  "north-park": { lat: 32.748, lon: -117.13 },
  "la-jolla": { lat: 32.832, lon: -117.271 },
  downtown: { lat: 32.715, lon: -117.16 },
  "el-cajon": { lat: 32.795, lon: -116.962 },
  chula: { lat: 32.64, lon: -117.084 },
  encinitas: { lat: 33.037, lon: -117.292 },
  "mira-mesa": { lat: 32.915, lon: -117.138 },
  escondido: { lat: 33.119, lon: -117.086 },
};

export function zoneCentroid(
  zoneId: string,
  fromApi?: { lat: number; lon: number } | null,
): { lat: number; lon: number } {
  if (fromApi && Number.isFinite(fromApi.lat) && Number.isFinite(fromApi.lon)) {
    return { lat: fromApi.lat, lon: fromApi.lon };
  }
  return SD_ZONE_CENTROIDS[zoneId] ?? { lat: 32.7157, lon: -117.1611 };
}
