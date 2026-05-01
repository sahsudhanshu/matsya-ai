from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.db import fetchone
import json
import asyncio

async def get_group_details(group_id: str, user_id:str)-> str:
    print("get_group_details tool called")

    try:
        item = fetchone("SELECT * FROM `groups` WHERE groupId = %s", (group_id,))
    except Exception as e:
        return f"Error fetching group details: {e}"

    if not item:
        return f"Could not find group with id {group_id}."

    if item.get("userId") != user_id:
        return f"You do not have permission to view details of group {group_id}."

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
            lines.append("\n**Alert**: Disease or health issues were detected in this batch.")

    elif status != "completed":
        lines.append("\nNote: Group analysis is not fully complete. Aggregate stats are not yet available.")


    return "\n".join(lines)



result=asyncio.run(get_group_details("0bf2c579-d1be-4aa2-a8bd-170181c35639","a1232dba-d0f1-707b-d35b-3a09c92b693a"))

print(result)