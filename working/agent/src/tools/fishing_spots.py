"""
Fishing Spots tool - finds nearby water bodies, sub-samples real points WITHIN
each body, and scores every point for fishing viability.

Data sources
────────────
• Overpass API (OpenStreetMap)    - real water body geometries + sub-sampled points
• ERDDAP / NASA MODIS (free)      - chlorophyll-a as marine fish-density proxy
• OpenWeatherMap                  - live weather at each point
• DynamoDB ai-bharat-images       - recency-weighted user catch history
• Gemini + Google Search          - web-sourced fish activity per water body
• User GPS                        - transport cost

Confidence (0–100) per point
────────────────────────────
  Fish Density  60 %  - chlorophyll (marine) + DynamoDB catches + Gemini web search
  Weather       25 %  - wind, rain, clouds
  Transport     15 %  - distance from user

Color
─────
  #10b981 (green)  confidence ≥ 68
  #f59e0b (amber)  45 – 67
  #ef4444 (red)    < 45
"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from langchain_core.tools import tool

from src.config.settings import GOOGLE_API_KEY, GEMINI_MODEL, OPENWEATHERMAP_API_KEY
from src.utils.db import fetchall


# ─────────────────────────────────────────────────────────────────────────────
# Geometric helpers
# ─────────────────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _sample_geometry_points(
    geometry: list[dict], name: str, water_type: str, n_sub: int = 3
) -> list[dict]:
    """
    Given a list of OSM geometry nodes [{lat, lon}, ...] for a water body way,
    return a centroid point + up to n_sub evenly-spaced real points along / within
    the body's shape.
    Each returned point: {name, lat, lon, type, is_sub, parent_name}
    """
    if not geometry:
        return []
    total = len(geometry)

    # Centroid
    c_lat = sum(g["lat"] for g in geometry) / total
    c_lon = sum(g["lon"] for g in geometry) / total
    points = [{
        "name": name, "lat": c_lat, "lon": c_lon,
        "type": water_type, "is_sub": False, "parent_name": name,
    }]

    if total >= 4:
        step = max(1, total // (n_sub + 1))
        for i in range(1, n_sub + 1):
            idx = min(i * step, total - 1)
            g = geometry[idx]
            points.append({
                "name": f"{name} - section {i}",
                "lat": g["lat"], "lon": g["lon"],
                "type": water_type, "is_sub": True, "parent_name": name,
            })

    return points


# ─────────────────────────────────────────────────────────────────────────────
# Data fetchers
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_overpass_bodies(lat: float, lon: float, radius_m: int) -> list[dict]:
    """
    Fetch water body ways/nodes from Overpass *with full geometry*.
    Also fetches named fishing spots, ghats, jetties, ferry terminals.
    Returns list of bodies: {name, water_type, centroid_lat, centroid_lon, geometry[]}
    """
    # Cap maximum radius to 50km to avoid overwhelming the public Overpass API (504 timeouts)
    effective_radius = min(radius_m, 20000)

    async def _do_query(r_m: int) -> list:
        query = (
            f"[out:json][timeout:30];\n"
            f"(\n"
            f"  way[\"waterway\"~\"river|stream|canal\"][\"name\"](around:{r_m},{lat},{lon});\n"
            f"  way[\"natural\"=\"water\"][\"name\"](around:{r_m},{lat},{lon});\n"
            f"  way[\"natural\"~\"beach|coastline\"](around:{r_m},{lat},{lon});\n"
            f"  node[\"natural\"~\"bay|beach|cape\"][\"name\"](around:{r_m},{lat},{lon});\n"
            f"  node[\"leisure\"=\"fishing\"](around:{r_m},{lat},{lon});\n"
            f"  node[\"sport\"=\"fishing\"](around:{r_m},{lat},{lon});\n"
            f"  node[\"amenity\"=\"ferry_terminal\"][\"name\"](around:{r_m},{lat},{lon});\n"
            f"  node[\"waterway\"=\"dock\"][\"name\"](around:{r_m},{lat},{lon});\n"
            f");\n"
            f"out geom 40;"
        )
        async with httpx.AsyncClient(timeout=28) as client:
            resp = await client.post(
                "https://overpass.kumi.systems/api/interpreter",
                data={"data": query},
                headers={"User-Agent": "MatsyaAI Fishing Assistant (contact@matsya.ai)", "Accept": "application/json"}
            )
            resp.raise_for_status()
            return resp.json().get("elements", [])

    elements = []
    try:
        elements = await _do_query(effective_radius)
    except Exception as e:
        print(f"[fishing_spots] Overpass error at {effective_radius}m radius: {type(e).__name__} - {e}", flush=True)
        # Fallback 1: Try a smaller 10km radius
        if effective_radius > 10000:
            try:
                print("[fishing_spots] Retrying Overpass with 10km radius...", flush=True)
                elements = await _do_query(10000)
            except Exception as e2:
                print(f"[fishing_spots] Overpass fallback error: {type(e2).__name__} - {e2}", flush=True)
                
    if not elements:
        return []

    bodies: list[dict] = []
    seen: set[str] = set()

    for elem in elements:
        tags = elem.get("tags", {})
        name = (
            tags.get("name") or tags.get("name:en") or tags.get("name:hi")
            or tags.get("waterway") or tags.get("natural")
            or tags.get("leisure") or "Water Body"
        )
        water_type = tags.get("natural") or tags.get("waterway") or tags.get("leisure") or "water"

        # Geometry
        if elem["type"] == "node":
            geom = [{"lat": elem["lat"], "lon": elem["lon"]}]
        else:
            geom = elem.get("geometry", [])
            if not geom:
                center = elem.get("center", {})
                if center:
                    geom = [{"lat": center["lat"], "lon": center["lon"]}]

        if not geom:
            continue

        c_lat = sum(g["lat"] for g in geom) / len(geom)
        c_lon = sum(g["lon"] for g in geom) / len(geom)
        key = f"{name.lower().strip()}_{water_type}"
        if key in seen:
            continue
        seen.add(key)

        bodies.append({
            "name": name, "water_type": water_type,
            "centroid_lat": c_lat, "centroid_lon": c_lon,
            "geometry": geom,
        })

    return bodies[:15]


async def _fetch_chlorophyll_score(
    client: httpx.AsyncClient, lat: float, lon: float
) -> Optional[float]:
    """
    Fetch chlorophyll-a (mg/m³) from NASA MODIS via ERDDAP (free, no API key).
    Higher chlorophyll → more phytoplankton → more fish.
    Returns 0-100 score, or None for inland / cloud-covered / unavailable areas.
    """
    delta = 0.1
    url = (
        f"https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdMH1chla1day.json"
        f"?chlorophyll%5B(last)%5D%5B({lat - delta:.5f}):({lat + delta:.5f})%5D"
        f"%5B({lon - delta:.5f}):({lon + delta:.5f})%5D"
    )
    try:
        r = await client.get(url, timeout=8)
        if r.status_code != 200:
            return None
        rows = r.json().get("table", {}).get("rows", [])
        values = []
        for row in rows:
            v = row[-1]
            if v is not None:
                try:
                    f = float(v)
                    if math.isfinite(f) and f > 0:
                        values.append(f)
                except (TypeError, ValueError):
                    pass
        if not values:
            return None
        chl = sum(values) / len(values)
        # Score mapping (mg/m³ → 0-100)
        if chl >= 10:  return 97.0
        if chl >= 5:   return 87.0
        if chl >= 2:   return 73.0
        if chl >= 0.5: return 55.0
        if chl >= 0.1: return 38.0
        return 22.0
    except Exception:
        return None


async def _fetch_gemini_web_score(
    client: httpx.AsyncClient, water_body_name: str, lat: float, lon: float
) -> Optional[float]:
    """
    Ask Gemini (with Google Search grounding) for a fish activity score (0–100)
    for the given water body. Called once per body; shared across its sub-points.
    Returns None on failure or missing API key - existing formula applies unchanged.
    """
    if not GOOGLE_API_KEY:
        return None

    model_id = GEMINI_MODEL.replace("models/", "")
    prompt = (
        f"How good is '{water_body_name}' (near {lat:.3f}°N, {lon:.3f}°E, India) for fishing? "
        f"Use web search to find: fish species present, fishing activity, catch reports, aquaculture. "
        f'Reply ONLY with valid JSON: {{"score": <integer 0-100>, "reason": "<10 words max>"}}'
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 128},
    }
    try:
        r = await client.post(url, json=payload, params={"key": GOOGLE_API_KEY}, timeout=10)
        if r.status_code != 200:
            print(f"[fishing_spots] Gemini web search HTTP {r.status_code}", flush=True)
            return None
        parts = r.json()["candidates"][0]["content"]["parts"]
        text = next((p.get("text", "") for p in reversed(parts) if "text" in p), "")
        match = re.search(r'\{[^}]+\}', text)
        if match:
            data = json.loads(match.group())
            score = float(data.get("score", 50))
            print(f"[fishing_spots] {water_body_name}: Gemini web score={score}", flush=True)
            return min(100.0, max(0.0, round(score, 1)))
    except Exception as exc:
        print(f"[fishing_spots] Gemini web score error: {exc}", flush=True)
    return None


def _fish_density_score(
    spot_lat: float, spot_lon: float, catch_markers: list[dict]
) -> float:
    """
    Continuous recency-weighted catch density → 0-100.
    catch_markers: [{lat, lon, days_ago}]
    Recent catches (≤7 days) count 3×; last month 2×; last quarter 1.5×; older 1×.
    Distance decays linearly to 0 at 30 km.
    """
    weighted = 0.0
    for m in catch_markers:
        dist = _haversine(spot_lat, spot_lon, m["lat"], m["lon"])
        if dist > 30:
            continue
        dist_w = max(0.05, 1 - dist / 30)
        days = m.get("days_ago", 365)
        time_w = 3.0 if days <= 7 else (2.0 if days <= 30 else (1.5 if days <= 90 else 1.0))
        weighted += dist_w * time_w
    if weighted == 0:
        return 20.0
    return min(95.0, round(20.0 + weighted * 7.5, 1))


def _combined_density(
    chl_score: Optional[float],
    dynamo_score: float,
    web_score: Optional[float] = None,
) -> float:
    """Combine chlorophyll (ERDDAP), DynamoDB catches, and Gemini web search into fish_s.

    All 3 sources  : chl*0.35 + dynamo*0.25 + web*0.40
    Chl + dynamo   : chl*0.60 + dynamo*0.40
    Web + dynamo   : dynamo*0.55 + web*0.45
    Dynamo only    : dynamo
    """
    has_chl = chl_score is not None
    has_web = web_score is not None
    if has_chl and has_web:
        return round(chl_score * 0.35 + dynamo_score * 0.25 + web_score * 0.40, 1)
    if has_chl:
        return round(chl_score * 0.60 + dynamo_score * 0.40, 1)
    if has_web:
        return round(dynamo_score * 0.55 + web_score * 0.45, 1)
    return dynamo_score


def _weather_score(wind_speed: float, rain_1h: float, clouds: int) -> float:
    wind_s = (
        100 if wind_speed < 3 else 85 if wind_speed < 6 else
        65 if wind_speed < 10 else 40 if wind_speed < 14 else 15
    )
    rain_pen = 0 if rain_1h == 0 else 10 if rain_1h < 1 else 25 if rain_1h < 5 else 40
    cloud_s = 70 if clouds < 20 else 90 if clouds < 60 else 60
    return max(0.0, min(100.0, wind_s * 0.55 + cloud_s * 0.25 - rain_pen))


def _transport_score(dist_km: float) -> float:
    return (
        100.0 if dist_km < 5 else 90.0 if dist_km < 15 else
        78.0 if dist_km < 25 else 62.0 if dist_km < 40 else 45.0
    )


def _confidence_color(score: float) -> str:
    return "#10b981" if score >= 68 else ("#f59e0b" if score >= 45 else "#ef4444")


# ─────────────────────────────────────────────────────────────────────────────
# Tool
# ─────────────────────────────────────────────────────────────────────────────

@tool
async def get_nearby_fishing_spots(
    latitude: float,
    longitude: float,
    radius_km: Optional[float] = 50,
) -> str:
    """
    Find nearby water bodies using real OpenStreetMap data, sub-sample actual points
    WITHIN each body (river bends, lake sections, coastal zones), and score every
    point for fishing viability using:
      • Live weather per body (OpenWeatherMap)
      • Marine chlorophyll-a via NASA MODIS/ERDDAP - real phytoplankton/fish proxy
      • Recency-weighted historical catch records from the app database
      • Transport cost - distance from the user's GPS location

    Also discovers named fishing spots, ghats, jetties, and ferry terminals nearby.

    Confidence = Weather 35% + Fish Density 40% + Transport 25%
    Color: 🟢 green (≥68) · 🟡 amber (45–67) · 🔴 red (<45)

    Args:
        latitude: User's current latitude (e.g. 15.4909 for Goa)
        longitude: User's current longitude (e.g. 73.8278 for Goa)
        radius_km: Search radius in km (default 50)
    """
    print(f"[TOOL] get_nearby_fishing_spots -> lat={latitude}, lon={longitude}, r={radius_km}km", flush=True)
    radius_m = int((radius_km or 50) * 1000)
    now_utc = datetime.now(timezone.utc)

    # ── Step 1: Water body geometries + fishing nodes from OpenStreetMap ──────
    print("[fishing_spots] Querying Overpass for water body geometries...", flush=True)
    bodies = await _fetch_overpass_bodies(latitude, longitude, radius_m)

    if not bodies:
        return json.dumps({
            "error": "No water bodies found. Try increasing radius or check connectivity.",
            "spots": [],
        }, indent=2)
    print(f"[fishing_spots] {len(bodies)} water bodies found.", flush=True)

    # ── Step 2: Recency-weighted catch records from MySQL ─────────────────────
    catch_markers: list[dict] = []
    try:
        rows = fetchall(
            "SELECT latitude, longitude, createdAt FROM images WHERE status = 'completed' AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY createdAt DESC LIMIT 500",
        )
        for item in rows:
            try:
                m_lat = float(item["latitude"])
                m_lon = float(item["longitude"])
                if not (math.isfinite(m_lat) and math.isfinite(m_lon)):
                    continue
                days_ago = 365
                created = item.get("createdAt", "")
                if created:
                    try:
                        ts = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                        days_ago = max(0, (now_utc - ts).days)
                    except ValueError:
                        pass
                catch_markers.append({"lat": m_lat, "lon": m_lon, "days_ago": days_ago})
            except (TypeError, ValueError):
                continue
    except Exception as e:
        print(f"[fishing_spots] MySQL error: {e}", flush=True)
    print(f"[fishing_spots] {len(catch_markers)} catch records loaded.", flush=True)

    # ── Step 3: Score each body + its sub-points ───────────────────────────────
    bodies_sorted = sorted(
        bodies,
        key=lambda b: _haversine(latitude, longitude, b["centroid_lat"], b["centroid_lon"]),
    )[:20]

    all_spots: list[dict] = []

    async with httpx.AsyncClient(timeout=12) as client:
        for body in bodies_sorted:
            c_lat, c_lon = body["centroid_lat"], body["centroid_lon"]

            # Weather at centroid (same for all sub-points of this body)
            weather_s = 50.0
            if OPENWEATHERMAP_API_KEY:
                try:
                    wr = await client.get(
                        "https://api.openweathermap.org/data/2.5/weather",
                        params={"lat": c_lat, "lon": c_lon,
                                "appid": OPENWEATHERMAP_API_KEY, "units": "metric"},
                    )
                    if wr.status_code == 200:
                        wd = wr.json()
                        weather_s = _weather_score(
                            wd.get("wind", {}).get("speed", 5),
                            wd.get("rain", {}).get("1h", 0),
                            wd.get("clouds", {}).get("all", 50),
                        )
                except Exception:
                    pass

            # Chlorophyll at centroid - works for sea/coast, returns None inland
            chl_score = await _fetch_chlorophyll_score(client, c_lat, c_lon)
            if chl_score is not None:
                print(f"[fishing_spots] {body['name']}: chlorophyll score={chl_score}", flush=True)

            # Gemini web search score - per water body name, shared by sub-points
            web_score = await _fetch_gemini_web_score(client, body["name"], c_lat, c_lon)

            # Sub-sample points within this body
            sub_points = _sample_geometry_points(body["geometry"], body["name"], body["water_type"], n_sub=3)

            for pt in sub_points:
                dist = _haversine(latitude, longitude, pt["lat"], pt["lon"])
                transport_s = _transport_score(dist)
                dynamo_s = _fish_density_score(pt["lat"], pt["lon"], catch_markers)
                fish_s = _combined_density(chl_score, dynamo_s, web_score)
                confidence = round(fish_s * 0.60 + weather_s * 0.25 + transport_s * 0.15, 1)

                all_spots.append({
                    "name": pt["name"],
                    "parent_water_body": pt["parent_name"],
                    "latitude": round(pt["lat"], 6),
                    "longitude": round(pt["lon"], 6),
                    "type": pt["type"],
                    "is_sub_point": pt["is_sub"],
                    "distance_km": round(dist, 1),
                    "weather_score": round(weather_s, 1),
                    "fish_density_score": round(fish_s, 1),
                    "transport_score": round(transport_s, 1),
                    "chlorophyll_available": chl_score is not None,
                    "gemini_web_score": web_score,
                    "confidence": confidence,
                    "color": _confidence_color(confidence),
                })

    all_spots.sort(key=lambda x: x["confidence"], reverse=True)
    top_spots = all_spots[:20]

    # ── Summary ────────────────────────────────────────────────────────────────
    lines = [
        f"🎣 **{len(top_spots)} fishing points across {len(bodies_sorted)} water bodies** "
        f"(within {radius_km:.0f} km)\n",
        "Score: Fish Density 60% (chlorophyll + catches) | Weather 25% | Transport 15%\n",
    ]
    for i, s in enumerate(top_spots[:8], 1):
        e = "🟢" if s["confidence"] >= 68 else ("🟡" if s["confidence"] >= 45 else "🔴")
        chl_tag = " 🌊" if s["chlorophyll_available"] else ""
        lines.append(
            f"  {i}. {e} **{s['name']}** ({s['type']}) - {s['distance_km']} km{chl_tag}\n"
            f"     Confidence: **{s['confidence']}/100** | "
            f"Weather: {s['weather_score']} | Fish: {s['fish_density_score']} | "
            f"Transport: {s['transport_score']}"
        )

    return json.dumps({
        "spots": top_spots,
        "user_location": {"lat": latitude, "lon": longitude},
        "total_bodies_found": len(bodies),
        "summary": "\n".join(lines),
    }, indent=2)
