"""
Map / ocean data tool - provides region context for the agent.

Queries the images table in MySQL for geo-tagged catch records
(matching the backend getMapData Lambda), and combines with static zone/harbor data.
"""
from __future__ import annotations
import json
import math
from typing import Optional
from langchain_core.tools import tool

from src.utils.db import fetchall


# ── Static reference data ────────────────────────────────────────────────────

OCEAN_ZONES = [
    {
        "name": "Exclusive Economic Zone (EEZ) - India",
        "description": "India's 200 nautical mile exclusive economic zone. Fishing permitted with valid license.",
        "bounds": {"north": 23.5, "south": 6.5, "east": 80.0, "west": 66.0},
    },
    {
        "name": "Territorial Waters",
        "description": "12 nautical miles from coastline. Traditional fishing allowed.",
        "bounds": {"north": 23.5, "south": 6.5, "east": 78.0, "west": 68.0},
    },
]

FISHING_MARKERS = [
    {"name": "Mumbai Fishing Harbor", "lat": 18.9485, "lon": 72.8372, "type": "harbor"},
    {"name": "Sassoon Docks", "lat": 18.9265, "lon": 72.8312, "type": "market"},
    {"name": "Versova Jetty", "lat": 19.1347, "lon": 72.8120, "type": "harbor"},
    {"name": "Mangalore Fishing Port", "lat": 12.8650, "lon": 74.8302, "type": "harbor"},
    {"name": "Kochi Fishing Harbour", "lat": 9.9370, "lon": 76.2614, "type": "harbor"},
    {"name": "Visakhapatnam Fishing Harbour", "lat": 17.6915, "lon": 83.2974, "type": "harbor"},
    {"name": "Chennai Fishing Harbour", "lat": 13.1007, "lon": 80.2945, "type": "harbor"},
    {"name": "Paradip Port", "lat": 20.3166, "lon": 86.6114, "type": "harbor"},
    {"name": "Porbandar Fisheries", "lat": 21.6417, "lon": 69.6293, "type": "harbor"},
    {"name": "Tuticorin Harbour", "lat": 8.7642, "lon": 78.1348, "type": "harbor"},
    {"name": "Veraval Fish Market", "lat": 20.9067, "lon": 70.3679, "type": "market"},
    {"name": "Rameswaram", "lat": 9.2876, "lon": 79.3129, "type": "harbor"},
]

RESTRICTED_AREAS = [
    {
        "name": "Monsoon Fishing Ban Zone (West Coast)",
        "description": "Fishing banned June 1 – July 31 along west coast (mechanised boats).",
        "lat": 15.0, "lon": 72.0, "radius_km": 200,
    },
    {
        "name": "Monsoon Fishing Ban Zone (East Coast)",
        "description": "Fishing banned April 15 – June 14 along east coast (mechanised boats).",
        "lat": 14.0, "lon": 81.0, "radius_km": 200,
    },
]


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in km."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fetch_catch_markers(species_filter: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None) -> list[dict]:
    """
    Query images table from MySQL (mirrors getMapData Lambda).
    Returns list of {lat, lon, species, qualityGrade, weight_g, createdAt}.
    """
    where = ["status = 'completed'", "latitude IS NOT NULL", "longitude IS NOT NULL"]
    params = []

    if date_from:
        where.append("createdAt >= %s")
        params.append(date_from)
    if date_to:
        where.append("createdAt <= %s + 'T23:59:59Z'")
        params.append(date_to)

    sql = f"SELECT imageId, latitude, longitude, createdAt, analysisResult FROM images WHERE {' AND '.join(where)} ORDER BY createdAt DESC LIMIT 200"

    try:
        rows = fetchall(sql, params or None)
    except Exception:
        return []

    markers = []
    for item in rows:
        try:
            lat = float(item.get("latitude", 0))
            lon = float(item.get("longitude", 0))
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(lat) and math.isfinite(lon)):
            continue
        ar = item.get("analysisResult") or {}
        if isinstance(ar, str):
            try:
                ar = json.loads(ar)
            except Exception:
                ar = {}
        if species_filter and ar.get("species", "").lower() != species_filter.lower():
            continue
        markers.append({
            "lat": lat,
            "lon": lon,
            "species": ar.get("species", "Unknown"),
            "qualityGrade": ar.get("qualityGrade", ""),
            "weight_g": (ar.get("measurements") or {}).get("weight_g"),
            "createdAt": str(item.get("createdAt", ""))[:10],
        })
    return markers


@tool
def get_map_data(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = 300,
    species: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    query: Optional[str] = None,
) -> str:
    """
    Get real geo-tagged catch records from the database, nearby harbors/markets,
    restricted zones, and ocean zone info. Mirrors the backend map API.

    Args:
        latitude: Center latitude to search around (optional)
        longitude: Center longitude to search around (optional)
        radius_km: Search radius in km for catch records (default 300)
        species: Filter catches by fish species name e.g. 'Pomfret' (optional)
        date_from: ISO date string start filter e.g. '2026-01-01' (optional)
        date_to: ISO date string end filter e.g. '2026-03-07' (optional)
        query: Free text search for a harbor/location name (optional)
    """
    print(f"[TOOL] get_map_data called -> lat={latitude}, lon={longitude}, radius={radius_km}km, species={species!r}, query={query!r}", flush=True)
    lines: list[str] = []

    # ── Real catch records from DynamoDB ─────────────────────────────────
    catch_markers = _fetch_catch_markers(species_filter=species, date_from=date_from, date_to=date_to)

    if latitude is not None and longitude is not None:
        # Filter to radius and rank by distance
        nearby_catches = sorted(
            [m for m in catch_markers if _haversine(latitude, longitude, m["lat"], m["lon"]) <= (radius_km or 300)],
            key=lambda m: _haversine(latitude, longitude, m["lat"], m["lon"]),
        )

        if nearby_catches:
            lines.append(f"🐟 **Recent Catches Near This Location** ({len(nearby_catches)} records within {radius_km:.0f} km):")
            # Group by species for a summary
            from collections import Counter
            species_counts: Counter = Counter(m["species"] for m in nearby_catches)
            for sp, count in species_counts.most_common(8):
                catches_for_sp = [m for m in nearby_catches if m["species"] == sp]
                grades = [m["qualityGrade"] for m in catches_for_sp if m["qualityGrade"]]
                weights = [m["weight_g"] for m in catches_for_sp if m["weight_g"]]
                closest = catches_for_sp[0]
                dist = _haversine(latitude, longitude, closest["lat"], closest["lon"])
                detail = f"~{dist:.0f} km away"
                if grades:
                    detail += f", grade: {grades[0]}"
                if weights:
                    avg_w = sum(float(w) for w in weights) / len(weights)
                    detail += f", avg weight: {avg_w:.0f}g"
                lines.append(f"  • {sp}: {count} catch(es) - {detail}")
        else:
            lines.append(f"  No catch records found within {radius_km:.0f} km.")

        # ── Nearest harbors/markets ───────────────────────────────────────
        ranked_harbors = sorted(
            FISHING_MARKERS,
            key=lambda m: _haversine(latitude, longitude, m["lat"], m["lon"]),
        )[:5]
        lines.append("\n📍 **Nearest Harbors & Markets:**")
        for m in ranked_harbors:
            dist = _haversine(latitude, longitude, m["lat"], m["lon"])
            lines.append(f"  • {m['name']} ({m['type']}) - ~{dist:.0f} km")

        # ── Nearby restricted areas ───────────────────────────────────────
        nearby_restricted = [
            (area, _haversine(latitude, longitude, area["lat"], area["lon"]))
            for area in RESTRICTED_AREAS
            if _haversine(latitude, longitude, area["lat"], area["lon"]) < area["radius_km"] + 100
        ]
        if nearby_restricted:
            lines.append("\n⚠️ **Restricted/Ban Zones Nearby:**")
            for area, dist in nearby_restricted:
                lines.append(f"  • {area['name']}: {area['description']} (~{dist:.0f} km)")

    elif query:
        # Keyword search in harbor names
        q = query.lower()
        matches = [m for m in FISHING_MARKERS if q in m["name"].lower()]
        if matches:
            lines.append(f"🔍 **Search results for '{query}':**")
            for m in matches:
                lines.append(f"  • {m['name']} ({m['type']}) - {m['lat']:.4f}N, {m['lon']:.4f}E")
        else:
            lines.append(f"No harbors/markets found matching '{query}'.")

        # Also show any species-filtered catches if species param given
        if catch_markers:
            lines.append(f"\n🐟 **Catch records** (species={species or 'all'}): {len(catch_markers)} total in database")

    else:
        # Overview
        lines.append("🗺️ **Indian Ocean Fishing Zones:**")
        for z in OCEAN_ZONES:
            lines.append(f"  • {z['name']}: {z['description']}")
        lines.append(f"\n  Tracked harbors/markets: {len(FISHING_MARKERS)}")
        lines.append(f"  Known restricted areas: {len(RESTRICTED_AREAS)}")
        lines.append(f"  Total geo-tagged catches in database: {len(catch_markers)}")
        if catch_markers:
            from collections import Counter
            top = Counter(m["species"] for m in catch_markers).most_common(5)
            lines.append("  Top species on map: " + ", ".join(f"{sp}({n})" for sp, n in top))

    return "\n".join(lines) if lines else "No map data available."
