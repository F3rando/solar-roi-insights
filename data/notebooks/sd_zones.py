"""
San Diego metro zone definitions aligned with src/lib/solar.ts (SAN_DIEGO_ZONES ids).
Nearest-centroid assignment uses lat/lon only.
"""

from __future__ import annotations

import math

# Rough San Diego County bounding box (WGS84). Tune if you need tighter coastal/desert cuts.
SD_CA_BBOX = {
    "lat_min": 32.53,
    "lat_max": 33.30,
    "lon_min": -117.62,
    "lon_max": -116.08,
}

# Display centroids — same ids/names/order as app + public/processed/v1/regions.json
ZONE_CENTROIDS: list[dict[str, float | str]] = [
    {"id": "north-park", "name": "North Park", "lat": 32.748, "lon": -117.130},
    {"id": "la-jolla", "name": "La Jolla", "lat": 32.832, "lon": -117.271},
    {"id": "downtown", "name": "Downtown", "lat": 32.715, "lon": -117.160},
    {"id": "el-cajon", "name": "El Cajon", "lat": 32.795, "lon": -116.962},
    {"id": "chula", "name": "Chula Vista", "lat": 32.640, "lon": -117.084},
    {"id": "encinitas", "name": "Encinitas", "lat": 33.037, "lon": -117.292},
    {"id": "mira-mesa", "name": "Mira Mesa", "lat": 32.915, "lon": -117.138},
    {"id": "escondido", "name": "Escondido", "lat": 33.119, "lon": -117.086},
]


def in_sd_county_bbox(lat: float, lon: float) -> bool:
    return (
        SD_CA_BBOX["lat_min"] <= lat <= SD_CA_BBOX["lat_max"]
        and SD_CA_BBOX["lon_min"] <= lon <= SD_CA_BBOX["lon_max"]
    )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km (adequate for nearest-zone tie-break)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def nearest_zone_id(lat: float, lon: float) -> str:
    best_id = ZONE_CENTROIDS[0]["id"]
    best_d = float("inf")
    for z in ZONE_CENTROIDS:
        d = haversine_km(lat, lon, float(z["lat"]), float(z["lon"]))
        if d < best_d:
            best_d = d
            best_id = str(z["id"])
    return best_id


def zone_meta(zid: str) -> tuple[str, float, float]:
    for z in ZONE_CENTROIDS:
        if z["id"] == zid:
            return str(z["name"]), float(z["lat"]), float(z["lon"])
    raise KeyError(zid)
