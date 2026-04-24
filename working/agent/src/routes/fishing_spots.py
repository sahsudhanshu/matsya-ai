"""
Fishing spots route - two endpoints:

  GET /fishing-spots              → plain JSON (legacy)
  GET /fishing-spots/stream       → SSE stream with progress + final result

SSE event types
───────────────
  data: {"type":"progress","stage":"scan","message":"...","pct":N}
  data: {"type":"result","spots":[...],"summary":"...","total_bodies_found":N}
  data: {"type":"error","error":"..."}
  data: {"type":"cancelled"}
"""
from __future__ import annotations

import asyncio
import json
import math
import httpx
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from src.utils.auth import TokenPayload, verify_token
from src.tools.fishing_spots import (
    get_nearby_fishing_spots,
    _fetch_overpass_bodies,
    _fetch_chlorophyll_score,
    _fetch_gemini_web_score,
    _sample_geometry_points,
    _haversine,
    _fish_density_score,
    _combined_density,
    _weather_score,
    _transport_score,
    _confidence_color,
)
from src.config.settings import OPENWEATHERMAP_API_KEY
from src.utils.db import fetchall

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


def _prog(stage: str, message: str, pct: int) -> str:
    return _sse({"type": "progress", "stage": stage, "message": message, "pct": pct})


# ── plain JSON endpoint (unchanged) ──────────────────────────────────────────

@router.get("")
async def get_fishing_spots(
    lat: float = Query(..., description="User latitude"),
    lon: float = Query(..., description="User longitude"),
    radius_km: float = Query(50.0, description="Search radius in km"),
    user: TokenPayload = Depends(verify_token),
):
    """Return scored fishing spots as structured JSON for map rendering."""
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    if not (1 <= radius_km <= 200):
        raise HTTPException(status_code=400, detail="radius_km must be between 1 and 200")

    result_str = await get_nearby_fishing_spots.ainvoke({
        "latitude": lat,
        "longitude": lon,
        "radius_km": radius_km,
    })

    try:
        data = json.loads(result_str)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500, detail="Tool returned invalid JSON")

    return data


# ── SSE streaming endpoint ────────────────────────────────────────────────────

@router.get("/stream")
async def stream_fishing_spots(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(50.0),
    user: TokenPayload = Depends(verify_token),
):
    """
    SSE stream that runs the full fishing-spots scan step by step and emits
    progress events so the client can display a live DEEP SCAN animation.
    Aborts cleanly when the client closes the connection.
    """
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    if not (1 <= radius_km <= 200):
        raise HTTPException(status_code=400, detail="radius_km must be between 1 and 200")

    async def generate() -> AsyncIterator[str]:
        cancelled = False

        async def is_cancelled() -> bool:
            return await request.is_disconnected()

        try:
            # ── Stage 1: Initialising ──────────────────────────────────────
            yield _prog("init", "Initialising deep scan engine...", 2)
            await asyncio.sleep(0.3)

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            yield _prog("init", "Linking up with satellite data feeds...", 5)
            await asyncio.sleep(0.4)

            # ── Stage 2: OSM / Overpass ───────────────────────────────────
            yield _prog("osm", " Scanning OpenStreetMap for water bodies...", 8)
            radius_m = int((radius_km or 50) * 1000)
            bodies = await _fetch_overpass_bodies(lat, lon, radius_m)

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            if not bodies:
                yield _sse({"type": "error", "error": "No water bodies found in your area. Try increasing the radius."})
                return

            yield _prog("osm", f"Detected {len(bodies)} water bodies · sub-sampling key zones...", 18)
            await asyncio.sleep(0.2)

            # ── Stage 3: Catch history from MySQL ─────────────────────────
            yield _prog("history", "Pulling historical catch records from database...", 22)
            now_utc = datetime.now(timezone.utc)
            catch_markers: list[dict] = []
            try:
                rows = fetchall(
                    "SELECT latitude, longitude, createdAt FROM images WHERE status = 'completed' AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY createdAt DESC LIMIT 500"
                )
                for item in rows:
                    try:
                        m_lat, m_lon = float(item["latitude"]), float(item["longitude"])
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
            except Exception:
                pass  # Non-fatal

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            yield _prog("history", f"Loaded {len(catch_markers)} catch records · applying recency weights...", 28)
            await asyncio.sleep(0.2)

            # ── Stage 4: Per-body scoring ─────────────────────────────────
            bodies_sorted = sorted(
                bodies,
                key=lambda b: _haversine(lat, lon, b["centroid_lat"], b["centroid_lon"]),
            )[:20]

            all_spots: list[dict] = []
            stage_base = 30
            stage_range = 55  # pct span across all bodies

            async with httpx.AsyncClient(timeout=14) as client:
                q = asyncio.Queue()

                async def process_body(body_data):
                    body_name = body_data["name"]
                    c_lat, c_lon = body_data["centroid_lat"], body_data["centroid_lon"]
                    
                    await q.put({"message": f"Scanning «{body_name}»..."})
                    await asyncio.sleep(0.02)
                    
                    weather_s = 50.0
                    weather_task, chl_task, gemini_task = None, None, None

                    if OPENWEATHERMAP_API_KEY:
                        await q.put({"message": f"Checking weather conditions at {body_name}..."})
                        weather_task = asyncio.create_task(client.get(
                            "https://api.openweathermap.org/data/2.5/weather",
                            params={"lat": c_lat, "lon": c_lon, "appid": OPENWEATHERMAP_API_KEY, "units": "metric"}
                        ))
                    
                    await asyncio.sleep(0.02)
                    await q.put({"message": f"Analyzing water quality and food sources at {body_name}..."})
                    chl_task = asyncio.create_task(_fetch_chlorophyll_score(client, c_lat, c_lon))
                    
                    await asyncio.sleep(0.02)
                    await q.put({"message": f"Gathering local fishing reports for {body_name}..."})
                    gemini_task = asyncio.create_task(_fetch_gemini_web_score(client, body_name, c_lat, c_lon))

                    if weather_task:
                        try:
                            wr = await weather_task
                            if wr.status_code == 200:
                                wd = wr.json()
                                weather_s = _weather_score(
                                    wd.get("wind", {}).get("speed", 5),
                                    wd.get("rain", {}).get("1h", 0),
                                    wd.get("clouds", {}).get("all", 50),
                                )
                        except Exception:
                            pass

                    chl_score = await chl_task
                    web_score = await gemini_task

                    sub_points = _sample_geometry_points(
                        body_data["geometry"], body_name, body_data["water_type"], n_sub=3
                    )
                    
                    body_spots = []
                    for pt in sub_points:
                        dist = _haversine(lat, lon, pt["lat"], pt["lon"])
                        transport_s = _transport_score(dist)
                        dynamo_s = _fish_density_score(pt["lat"], pt["lon"], catch_markers)
                        fish_s = _combined_density(chl_score, dynamo_s, web_score)
                        confidence = round(fish_s * 0.60 + weather_s * 0.25 + transport_s * 0.15, 1)
                        color = _confidence_color(confidence)

                        body_spots.append({
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
                            "gemini_web_score": round(web_score, 1) if web_score is not None else None,
                            "confidence": confidence,
                            "color": color,
                        })
                    
                    return body_spots

                tasks = [asyncio.create_task(process_body(b)) for b in bodies_sorted]
                
                async def wait_all():
                    res = await asyncio.gather(*tasks, return_exceptions=True)
                    await q.put(None)  # Sentinel to stop the stream
                    return res
                
                waiter_task = asyncio.create_task(wait_all())
                
                msgs_received = 0
                max_msgs = len(bodies_sorted) * 5  # roughly 5 log lines expected per body maximum
                
                while True:
                    if await is_cancelled():
                        yield _sse({"type": "cancelled"})
                        return
                    
                    item = await q.get()
                    if item is None:
                        break
                        
                    msgs_received += 1
                    pct = stage_base + int((msgs_received / max_msgs) * stage_range)
                    pct = min(85, max(stage_base, pct))
                    
                    yield _prog("scan", item["message"], pct)
                
                results = await waiter_task
                for r in results:
                    if isinstance(r, list):
                        all_spots.extend(r)

            if await is_cancelled():
                yield _sse({"type": "cancelled"})
                return

            # ── Stage 5: Finalising ───────────────────────────────────────
            yield _prog("finalise", "⚡  Ranking and filtering spots by confidence...", 88)
            await asyncio.sleep(0.2)

            all_spots.sort(key=lambda s: s["confidence"], reverse=True)
            top = all_spots[:20]

            yield _prog("finalise", "🗂️  Building scan report...", 94)
            await asyncio.sleep(0.2)

            green = sum(1 for s in all_spots if s["color"] == "#10b981")
            amber = sum(1 for s in all_spots if s["color"] == "#f59e0b")
            red   = sum(1 for s in all_spots if s["color"] == "#ef4444")
            summary = (
                f"Deep scan complete - {len(all_spots)} total zones analyzed across "
                f"{len(bodies_sorted)} water bodies. "
                f"Found {green} excellent, {amber} moderate, and {red} low confidence spots. "
                f"Mapping top {len(top)} optimal locations."
            )

            yield _prog("done", "Deep scan complete. Mapping results...", 100)

            yield _sse({
                "type": "result",
                "spots": top,
                "summary": summary,
                "total_bodies_found": len(bodies),
                "user_location": {"lat": lat, "lon": lon},
            })

        except asyncio.CancelledError:
            yield _sse({"type": "cancelled"})
        except Exception as exc:
            yield _sse({"type": "error", "error": str(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
