"""
Specific group catch tool - queries a single group analysis result from MySQL.
"""
from __future__ import annotations
import json
from langchain_core.tools import tool

from src.utils.db import fetchone


@tool
def get_group_details(group_id: str, user_id: str = "") -> str:
    """
    Get the detailed analysis of a specific group catch (multi-image batch) using its group_id.
    This provides detailed aggregate metrics like total fish count, species distribution, 
    total estimated weight, and total market value.
    Do NOT pass user_id - it is injected automatically.

    Args:
        group_id: The unique identifier of the group catch to look up.
        user_id: Auto-injected by the system. Do not provide.
    """
    print(f"📦  [TOOL] get_group_details called → group_id={group_id!r}, user_id={user_id!r}")

    try:
        item = fetchone("SELECT * FROM `groups` WHERE groupId = %s", (group_id,))
    except Exception as e:
        return f"⚠️ Could not fetch details for group {group_id}: {e}"

    if not item:
        return f"Could not find any group catch record with ID {group_id}."

    if item.get("userId") != user_id:
        return f"You do not have permission to view group {group_id}."

    if item.get("analysisResult") and isinstance(item["analysisResult"], str):
        item["analysisResult"] = json.loads(item["analysisResult"])

    image_count = item.get("imageCount", "?")
    status = item.get("status", "unknown")
    date = item.get("createdAt", "Unknown date")[:10]
    
    ar = item.get("analysisResult") or {}
    agg = ar.get("aggregateStats") or {}

    total_fish = agg.get("totalFishCount", 0)
    species_dist: dict = agg.get("speciesDistribution", {})
    avg_conf = agg.get("averageConfidence", 0)
    disease = agg.get("diseaseDetected", False)
    est_weight = agg.get("totalEstimatedWeight", 0)
    est_value = agg.get("totalEstimatedValue", 0)

    lines = [
        f"📦 **Specific Group Catch Details** ({date})",
        f"• Group ID: {group_id}",
        f"• Images Uploaded: {image_count}",
        f"• Analysis Status: {status}",
    ]

    lat = item.get("latitude")
    lon = item.get("longitude")
    if lat and lon:
        lines.append(f"• Location: {lat:.4f}°N, {lon:.4f}°E")

    if status in ("completed", "partial") and total_fish:
        lines.append(f"\n📊 **Aggregate Statistics**")
        lines.append(f"• Total Fish Detected: {total_fish}")
        
        if species_dist:
            # Sort by count descending
            top_species = sorted(species_dist.items(), key=lambda x: x[1], reverse=True)
            species_str = ", ".join(f"{s} ({c})" for s, c in top_species)
            lines.append(f"• Species Breakdown: {species_str}")
            
        if avg_conf:
            lines.append(f"• Average Confidence: {avg_conf * 100:.0f}%")
        if est_weight:
            lines.append(f"• Estimated Total Weight: {est_weight:.1f} kg")
        if est_value:
            lines.append(f"• Estimated Total Value: ₹{est_value:,}")
        if disease:
            lines.append("\n⚠️ **Alert**: Disease or health issues were detected in this batch.")
            
    elif status != "completed":
        lines.append("\nNote: Group analysis is not fully complete. Aggregate stats are not yet available.")
        
    return "\n".join(lines)
