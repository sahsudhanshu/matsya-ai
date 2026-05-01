"""
Group history tool - queries the ai-bharat-groups table.

Groups represent multi-image batch uploads. Each group has:
  - groupId: unique ID (UUID)
  - imageCount: number of images in the batch
  - status: pending | processing | completed | partial | failed
  - analysisResult: { images[], aggregateStats, processedAt }
    - aggregateStats: { totalFishCount, speciesDistribution, averageConfidence,
                        diseaseDetected, totalEstimatedWeight, totalEstimatedValue }
  - optional GPS: latitude, longitude

This is the preferred way to see batch/group catches; use get_catch_history
for older individual single-image uploads.
"""
from __future__ import annotations
import json
from typing import Optional
from langchain_core.tools import tool
from src.config.settings import CATCH_HISTORY_PAGE_SIZE
from src.utils.db import fetchall


@tool
async def get_group_history(
    page: int = 1,
    limit: Optional[int] = None,
    user_id: str = "",
) -> str:
    """
    Get the user's recent group catch uploads (multi-image batch analysis sessions).
    Each group may contain multiple fish photos analysed together, with aggregate stats.
    Results are paginated - page 1 is the most recent.
    Do NOT pass user_id - it is injected automatically.

    Args:
        page: Page number (1-based). Default 1.
        limit: Max results per page. Default from settings.
        user_id: Auto-injected by the system. Do not provide.
    """
    print(f"📋  [TOOL] get_group_history called → user_id={user_id!r}, page={page}")
    page_size = limit or CATCH_HISTORY_PAGE_SIZE
    fetch_limit = page_size * page

    try:
        items = fetchall(
            "SELECT * FROM `groups` WHERE userId = %s ORDER BY createdAt DESC LIMIT %s",
            (user_id, fetch_limit),
        )
        for item in items:
            if item.get("analysisResult") and isinstance(item["analysisResult"], str):
                item["analysisResult"] = json.loads(item["analysisResult"])
    except Exception as e:
        return f"⚠️ Could not fetch group history: {e}"

    # In-memory pagination
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]

    if not page_items:
        if page == 1:
            return (
                "No group catch records found yet. "
                "Use the app to upload multiple fish photos at once to start group analysis!"
            )
        return f"No more group records on page {page}."

    lines = [f"📦 **Group Catch History** (Page {page}, showing {len(page_items)} groups):"]

    for i, item in enumerate(page_items, start=start + 1):
        group_id = item.get("groupId", "?")
        image_count = item.get("imageCount", "?")
        status = item.get("status", "unknown")
        date = item.get("createdAt", "Unknown date")
        ar = item.get("analysisResult") or {}
        agg = ar.get("aggregateStats") or {}

        total_fish = agg.get("totalFishCount", 0)
        species_dist = agg.get("speciesDistribution") or {}
        avg_conf = agg.get("averageConfidence", 0)
        disease = agg.get("diseaseDetected", False)
        est_weight = agg.get("totalEstimatedWeight", 0)
        est_value = agg.get("totalEstimatedValue", 0)

        line = f"\n  {i}. 📅 {date[:10]} | 🖼️ {image_count} image(s) | Status: {status}"

        if status in ("completed", "partial") and total_fish:
            line += f"\n     • Fish detected: {total_fish}"
            if species_dist:
                top_species = sorted(species_dist.items(), key=lambda x: x[1], reverse=True)[:3]
                species_str = ", ".join(f"{s} ({c})" for s, c in top_species)
                line += f"\n     • Species: {species_str}"
            if avg_conf:
                line += f"\n     • Avg confidence: {avg_conf * 100:.0f}%"
            if est_weight:
                line += f"\n     • Est. total weight: {est_weight:.1f} kg"
            if est_value:
                line += f"\n     • Est. value: ₹{est_value:,}"
            if disease:
                line += "\n     ⚠️ Disease indicators detected in this batch"

        lat = item.get("latitude")
        lon = item.get("longitude")
        if lat and lon:
            line += f"\n     📍 Location: {lat:.4f}°N, {lon:.4f}°E"

        line += f"\n     🔑 Group ID: {group_id}"
        lines.append(line)

    total = len(items)
    if total > start + page_size:
        lines.append(f"\n  → More group records available. Ask for page {page + 1}.")

    return "\n".join(lines)
