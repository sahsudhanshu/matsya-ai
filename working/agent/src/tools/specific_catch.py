"""
Specific catch tool - queries a single image analysis result from MySQL.
"""
from __future__ import annotations
import json
from langchain_core.tools import tool

from src.utils.db import fetchone


def _get_field(item: dict, ar: dict, key: str, default=None):
    """Read from nested analysisResult first, then fall back to top-level (legacy)."""
    return ar.get(key, item.get(key, default))

# async def get_catch_details(image_id: str, user_id: str = "") -> str:

@tool
def get_catch_details(image_id: str) -> str:
    """
    Get the detailed analysis of a specific catch (fish upload) using its image_id.
    This provides detailed metrics like length, weight, quality grade, and market value.
    Do NOT pass user_id - it is injected automatically.

    Args:
        image_id: The unique identifier of the catch/image to look up.
        user_id: Auto-injected by the system. Do not provide.
    """
    print(f"🔬  [TOOL] get_catch_details called → image_id={image_id!r}")

    try:
        item = fetchone("SELECT * FROM images WHERE imageId = %s", (image_id,))
        print(item)
    except Exception as e:
        return f"⚠️ Could not fetch details for catch {image_id}: {e}"

    if not item:
        return f"Could not find any catch record with ID {image_id}."

    # if item.get("userId") != user_id:
    #     return f"You do not have permission to view catch {image_id}."

    # Parse JSON analysisResult from MySQL
    if item.get("analysisResult") and isinstance(item["analysisResult"], str):
        item["analysisResult"] = json.loads(item["analysisResult"])

    # Read from nested analysisResult with legacy fallback
    ar = item.get("analysisResult") or {}

    species = _get_field(item, ar, "species", "Unknown")
    raw_confidence = _get_field(item, ar, "confidence", 0)
    # Normalise: backend stores 0-1 float, display as percentage
    confidence_pct = raw_confidence * 100 if raw_confidence <= 1 else raw_confidence

    location = item.get("location", "Unknown location")
    date = item.get("createdAt", "Unknown date")[:10]
    quality = _get_field(item, ar, "qualityGrade", "Unknown")
    scientific = _get_field(item, ar, "scientificName", "")
    is_sustainable = _get_field(item, ar, "isSustainable", False)

    # Weight and market value
    measurements = ar.get("measurements") or {}
    weight_g = measurements.get("weight_g", 0)
    weight_kg = _get_field(item, ar, "weightEstimate", weight_g / 1000 if weight_g else 0.0)

    market_est = ar.get("marketEstimate") or {}
    price_per_kg = _get_field(item, ar, "marketPriceEstimate", market_est.get("price_per_kg", 0))
    total_value = market_est.get("estimated_value") or round(weight_kg * price_per_kg)

    lines = [
        f"🐟 **Specific Catch Details: {species}** ({date})",
        f"• Image ID: {image_id}",
        f"• Location: {location}",
        f"• Confidence: {confidence_pct:.1f}%",
        f"• Quality Grade: {quality}",
        f"• Weight Estimate: {weight_kg:.2f} KG",
        f"• Estimated Value: ₹{total_value} (@ ₹{price_per_kg}/kg)",
        f"• Sustainability: {'Sustainable ✅' if is_sustainable else 'Limited/Not Sustainable ⚠️'}",
    ]

    if scientific:
        lines.insert(2, f"• Scientific Name: {scientific}")

    status = item.get("status", "unknown")
    if status != "completed":
        lines.append(f"\nNote: Analysis status is currently '{status}'. Some metrics may be missing or inaccurate until completed.")

    return "\n".join(lines)
