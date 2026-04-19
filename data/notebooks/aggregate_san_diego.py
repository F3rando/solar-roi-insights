#!/usr/bin/env python3
"""
Load data/raw/records.csv, filter to San Diego metro, assign nearest app zone,
write public/processed/v1/{manifest,summary,regions}.json.

Dependencies: Python 3.9+ (stdlib only — no pip required).

Run from repo root:
  python data/notebooks/aggregate_san_diego.py

Optional: `GOOGLE_SOLAR_API_KEY` in `.env.local` (or env) — calls Google Solar
Building Insights once per zone centroid and writes `solar_insights` on each
region row in `regions.json`.
"""
from __future__ import annotations

import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPT_DIR))

from sd_zones import SD_CA_BBOX, ZONE_CENTROIDS, nearest_zone_id, zone_meta

SD_CITY_TOKENS: frozenset[str] = frozenset(
    {
        "SAN DIEGO",
        "CHULA VISTA",
        "OCEANSIDE",
        "ESCONDIDO",
        "CARLSBAD",
        "EL CAJON",
        "VISTA",
        "ENCINITAS",
        "NATIONAL CITY",
        "LA MESA",
        "CORONADO",
        "POWAY",
        "LA JOLLA",
        "DEL MAR",
        "SOLANA BEACH",
        "SAN MARCOS",
        "SANTEE",
        "SPRING VALLEY",
        "FALLBROOK",
        "RAMONA",
        "LEMON GROVE",
        "IMPERIAL BEACH",
        "BONITA",
        "ALPINE",
        "BORREGO SPRINGS",
        "GULF",
        "HOMELAND",
        "PALA",
    }
)


def find_repo_root() -> Path:
    cwd = Path.cwd().resolve()
    for base in (cwd, cwd.parent, cwd.parent.parent):
        if (base / "package.json").is_file() and (base / "public" / "processed" / "v1").is_dir():
            return base
    raise SystemExit(
        "Could not find solar-roi-insights repo root. `cd` into the repo and run again."
    )


def _f(x: str | None) -> float | None:
    if x is None or (isinstance(x, str) and not str(x).strip()):
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _year(issue_date: str | None) -> int | None:
    if not issue_date or len(issue_date) < 4:
        return None
    y = issue_date[:4]
    if y.isdigit():
        return int(y)
    return None


def is_sd_row(row: dict[str, str]) -> bool:
    if (row.get("state") or "").upper() != "CA":
        return False
    county = (row.get("county") or "").upper()
    if "SAN DIEGO" in county:
        return True
    city = (row.get("city") or "").upper().strip()
    if city in SD_CITY_TOKENS:
        return True
    lat, lon = _f(row.get("latitude")), _f(row.get("longitude"))
    if lat is None or lon is None:
        return False
    return (
        SD_CA_BBOX["lat_min"] <= lat <= SD_CA_BBOX["lat_max"]
        and SD_CA_BBOX["lon_min"] <= lon <= SD_CA_BBOX["lon_max"]
    )


def load_and_filter(path: Path) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8", errors="replace") as f:
        r = csv.DictReader(f)
        for row in r:
            if is_sd_row(row):
                out.append(row)
    return out


def tertile_bucket(count: int, counts: list[int]) -> str:
    if not counts or max(counts) <= 0:
        return "medium"
    srt = sorted(counts)
    n = len(srt)
    lo_i = max(0, int((n - 1) / 3))
    hi_i = min(n - 1, int(2 * (n - 1) / 3))
    lo, hi = float(srt[lo_i]), float(srt[hi_i])
    if count >= hi:
        return "high"
    if count >= lo:
        return "medium"
    return "low"


def merge_env_local(root: Path) -> None:
    """Load repo `.env.local` into os.environ for keys not already set (shell wins)."""
    path = root / ".env.local"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, rest = line.partition("=")
        key, val = key.strip(), rest.strip()
        if key and key not in os.environ:
            os.environ[key] = val


def fetch_building_insights(lat: float, lon: float, api_key: str, timeout: float = 45.0) -> dict | None:
    """GET buildingInsights:findClosest. Returns parsed JSON on 200, else None."""
    q = urllib.parse.urlencode(
        {
            "location.latitude": f"{lat:.6f}",
            "location.longitude": f"{lon:.6f}",
            "key": api_key,
        }
    )
    url = f"https://solar.googleapis.com/v1/buildingInsights:findClosest?{q}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
            err = json.loads(body) if body else {}
            msg = err.get("error", {}).get("message", e.reason)
        except json.JSONDecodeError:
            msg = e.reason
        print(f"  Solar API HTTP {e.code} at ({lat:.4f},{lon:.4f}): {msg}")
        return None
    except urllib.error.URLError as e:
        print(f"  Solar API network error at ({lat:.4f},{lon:.4f}): {e.reason}")
        return None


def solar_insights_from_payload(data: dict) -> dict[str, float | int | str] | None:
    """Map Google Building Insights JSON to compact snake_case fields for regions.json."""
    sp = data.get("solarPotential")
    if not isinstance(sp, dict):
        return None
    out: dict[str, float | int | str] = {}
    if "maxSunshineHoursPerYear" in sp:
        out["max_sunshine_hours_per_year"] = round(float(sp["maxSunshineHoursPerYear"]), 2)
    if "carbonOffsetFactorKgPerMwh" in sp:
        out["carbon_offset_factor_kg_per_mwh"] = round(float(sp["carbonOffsetFactorKgPerMwh"]), 4)
    if "maxArrayPanelsCount" in sp:
        out["max_array_panels_count"] = int(sp["maxArrayPanelsCount"])
    iq = data.get("imageryQuality") or data.get("imagery_quality")
    if iq:
        out["imagery_quality"] = str(iq)
    return out if out else None


def median(nums: list[float]) -> float:
    if not nums:
        return 0.0
    s = sorted(nums)
    m = len(s) // 2
    if len(s) % 2:
        return s[m]
    return (s[m - 1] + s[m]) / 2.0


def yoy_pct(prev_n: int, curr_n: int) -> float:
    if prev_n <= 0:
        return round(100.0 * curr_n, 1) if curr_n else 0.0
    return round(100.0 * (curr_n - prev_n) / prev_n, 1)


def main() -> None:
    root = find_repo_root()
    merge_env_local(root)
    raw_path = root / "data/raw/records.csv"
    out_dir = root / "public/processed/v1"
    if not raw_path.is_file():
        raise SystemExit(f"Missing {raw_path}")

    solar_key = (os.environ.get("GOOGLE_SOLAR_API_KEY") or "").strip()
    rows = load_and_filter(raw_path)
    n_sd = len(rows)

    zone_ids = [str(z["id"]) for z in ZONE_CENTROIDS]

    # Zone-assigned rows (have coordinates)
    z_kw: dict[str, list[float]] = {z: [] for z in zone_ids}
    z_years_flat: dict[str, list[int]] = {z: [] for z in zone_ids}
    global_years: list[int] = []

    total_kw = 0.0
    for row in rows:
        kw = _f(row.get("kilowatt_value")) or 0.0
        total_kw += kw
        y = _year(row.get("issue_date"))
        if y is not None:
            global_years.append(y)
        lat, lon = _f(row.get("latitude")), _f(row.get("longitude"))
        if lat is None or lon is None:
            continue
        zid = nearest_zone_id(lat, lon)
        z_kw[zid].append(kw)
        if y is not None:
            z_years_flat[zid].append(y)

    year_counts: dict[int, int] = defaultdict(int)
    for y in global_years:
        year_counts[y] += 1

    last_year = max(global_years) if global_years else datetime.now().year
    prev_year = last_year - 1
    n_prev = int(year_counts.get(prev_year, 0))
    n_curr = int(year_counts.get(last_year, 0))
    yoy_summary = yoy_pct(n_prev, n_curr)

    total_mw = round(total_kw / 1000.0, 2)
    annual_kwh = total_kw * 1350.0
    co2_kt = round((annual_kwh * 0.000707) / 1000.0, 1)

    install_counts = [len(z_kw[z]) for z in zone_ids]

    geo_assigned = sum(install_counts)
    mx_cnt = max(install_counts) or 1

    regions_rows: list[dict] = []
    for zid in zone_ids:
        name, clat, clon = zone_meta(zid)
        kws = z_kw[zid]
        cnt = len(kws)

        yz = z_years_flat[zid]
        z_prev = sum(1 for y in yz if y == prev_year)
        z_curr = sum(1 for y in yz if y == last_year)
        z_yoy = yoy_pct(z_prev, z_curr)

        med_kw = median(kws)
        med_save = round(med_kw * 240.0, 0)
        bucket = tertile_bucket(cnt, install_counts)

        row_obj: dict = {
            "id": zid,
            "name": name,
            "centroid": {"lat": round(clat, 6), "lon": round(clon, 6)},
            "adoption_index": round(cnt / mx_cnt, 4),
            "yoy_growth_pct": z_yoy,
            "median_est_annual_savings_usd": int(med_save),
            "install_count_bucket": bucket,
        }
        if solar_key:
            payload = fetch_building_insights(clat, clon, solar_key)
            if payload:
                si = solar_insights_from_payload(payload)
                if si:
                    row_obj["solar_insights"] = si
            time.sleep(0.2)
        regions_rows.append(row_obj)

    summary = {
        "scope": {
            "label": "San Diego County — permit-derived (filtered)",
            "geo_level": "nearest_zone_centroid",
        },
        "kpis": {
            "total_estimated_installs": int(n_sd),
            "total_capacity_mw": total_mw,
            "median_payback_years": 8.2,
            "est_co2_avoided_kt_per_year": co2_kt,
            "yoy_growth_pct": float(yoy_summary),
        },
        "coverage": {"regions_count": len(zone_ids), "last_data_year": int(last_year)},
        "disclaimer": (
            "Derived from permit records in data/raw/records.csv; SD filter uses county/city/bbox. "
            "median_payback_years is a placeholder until tied to finance model. "
            "Coordinates assigned to nearest dashboard zone."
        ),
    }

    solar_enriched = (
        sum(1 for r in regions_rows if r.get("solar_insights")) if solar_key else 0
    )
    manifest = {
        "version": "1",
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_note": (
            f"aggregate_san_diego.py — {n_sd} rows SD-filtered from CSV."
            + (
                f" Google Solar Building Insights: {solar_enriched}/{len(zone_ids)} zones."
                if solar_key
                else ""
            )
        ),
        "summary": "processed/v1/summary.json",
        "regions": "processed/v1/regions.json",
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (out_dir / "regions.json").write_text(json.dumps({"regions": regions_rows}, indent=2), encoding="utf-8")

    dropped_geo = n_sd - geo_assigned
    print(f"Repo root: {root}")
    print(f"San Diego slice: {n_sd} rows | with lat/lon for zoning: {geo_assigned} | missing coords: {dropped_geo}")
    print(f"Written: {out_dir / 'manifest.json'}")
    print(f"Written: {out_dir / 'summary.json'}")
    print(f"Written: {out_dir / 'regions.json'}")
    if solar_key:
        print(
            f"Google Solar API: enriched {solar_enriched}/{len(zone_ids)} zone centroids "
            "(set GOOGLE_SOLAR_API_KEY empty to skip)."
        )
    else:
        print("Google Solar API: skipped (no GOOGLE_SOLAR_API_KEY).")
    print("Next: npm run data:validate")


if __name__ == "__main__":
    main()
