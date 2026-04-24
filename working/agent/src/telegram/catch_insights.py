"""
Catch insights generator - fetches a user's catch history and group batches
from MySQL and produces a concise Gemini-summarised snapshot for the
Telegram /start welcome message.
"""
from __future__ import annotations
import json
import logging
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from src.config.settings import (
    GOOGLE_API_KEY,
    GEMINI_MODEL,
)
from src.utils.db import fetchall

logger = logging.getLogger(__name__)


def _to_float(v) -> float:
    """Safe float conversion."""
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


async def get_catch_insights(user_id: str) -> Optional[str]:
    """
    Build a short capture-insights summary for *user_id*.

    Returns a Markdown-formatted string ready for Telegram, or ``None``
    if the user has no catch records.
    """
    if not user_id:
        return None

    # ── 1. Fetch recent individual images ─────────────────────────
    try:
        images = fetchall(
            "SELECT imageId, analysisResult FROM images WHERE userId = %s ORDER BY createdAt DESC LIMIT 50",
            (user_id,),
        )
        for img in images:
            if img.get("analysisResult") and isinstance(img["analysisResult"], str):
                img["analysisResult"] = json.loads(img["analysisResult"])
    except Exception as e:
        logger.error(f"Catch insights - images query failed: {e}")
        images = []

    # ── 2. Fetch recent group batches ────────────────────────────
    try:
        groups = fetchall(
            "SELECT groupId, analysisResult FROM `groups` WHERE userId = %s ORDER BY createdAt DESC LIMIT 30",
            (user_id,),
        )
        for grp in groups:
            if grp.get("analysisResult") and isinstance(grp["analysisResult"], str):
                grp["analysisResult"] = json.loads(grp["analysisResult"])
    except Exception as e:
        logger.error(f"Catch insights - groups query failed: {e}")
        groups = []

    if not images and not groups:
        return None

    # ── 3. Compute quick stats ───────────────────────────────────────────
    species_count: dict[str, int] = {}
    total_catches = 0
    total_weight_g = 0.0
    total_value = 0.0

    # Individual images
    for item in images:
        ar = item.get("analysisResult") or {}
        species = ar.get("species", "Unknown")
        species_count[species] = species_count.get(species, 0) + 1
        total_catches += 1

        measurements = ar.get("measurements") or {}
        total_weight_g += _to_float(measurements.get("weight_g", 0))

        market = ar.get("marketEstimate") or {}
        total_value += _to_float(market.get("estimated_value", 0))

    # Group batches
    for grp in groups:
        ar = grp.get("analysisResult") or {}
        agg = ar.get("aggregateStats") or {}

        fish_count = int(_to_float(agg.get("totalFishCount", 0)))
        total_catches += fish_count

        dist = agg.get("speciesDistribution") or {}
        for sp, cnt in dist.items():
            species_count[sp] = species_count.get(sp, 0) + int(_to_float(cnt))

        total_weight_g += _to_float(agg.get("totalEstimatedWeight", 0))
        total_value += _to_float(agg.get("totalEstimatedValue", 0))

    if total_catches == 0:
        return None

    top_species = sorted(species_count.items(), key=lambda x: x[1], reverse=True)[:5]
    total_weight_kg = total_weight_g / 1000 if total_weight_g > 0 else 0
    unique_species = len(species_count)

    # ── 4. Build stats context for LLM ───────────────────────────────────
    stats_text = (
        f"Total catches: {total_catches}\n"
        f"Unique species: {unique_species}\n"
        f"Top species: {', '.join(f'{s} ({c})' for s, c in top_species)}\n"
        f"Total weight: {total_weight_kg:.1f} kg\n"
        f"Estimated total value: ₹{total_value:,.0f}\n"
        f"Scan records: {len(images)} images, {len(groups)} group batches"
    )

    # ── 5. Generate a compact summary ─────────────────────────────
    try:
        from langchain_aws import ChatBedrockConverse
        import os

        use_claude = os.getenv("USE_CLAUDE", "true").strip().lower() in ("1", "true", "yes")
        use_gemini = os.getenv("USE_GEMINI", "true").strip().lower() in ("1", "true", "yes")

        claude_model = None
        if use_claude:
            try:
                claude_model = ChatBedrockConverse(
                    model="global.anthropic.claude-sonnet-4-6",
                    region_name=os.getenv("BEDROCK_REGION", "us-east-1"),
                    temperature=0.7,
                    max_tokens=500,
                    bedrock_api_key=os.getenv("BEDROCK_API_KEY", "") or None,
                )
            except Exception:
                pass

        gemini_model = None
        if use_gemini:
            try:
                gemini_model = ChatGoogleGenerativeAI(
                    model=GEMINI_MODEL or "gemini-3-flash-preview",
                    google_api_key=GOOGLE_API_KEY,
                    temperature=0.7,
                    max_output_tokens=500,
                )
            except Exception:
                pass

        if claude_model and gemini_model:
            llm = claude_model.with_fallbacks([gemini_model])
        elif claude_model:
            llm = claude_model
        elif gemini_model:
            llm = gemini_model
        else:
            raise RuntimeError("No LLM available for catch insights")

        prompt = (
            "You are Matsya AI, an AI fishing companion for Indian fishermen.\n"
            "Given the user's capture stats below, write a SHORT, encouraging\n"
            "Telegram welcome summary (4-6 lines max). Use emojis. Mention their\n"
            "top species, total catches, weight, and estimated earnings.\n"
            "Keep it under 400 characters. Do NOT use Markdown headers.\n\n"
            f"Stats:\n{stats_text}"
        )
        response = await llm.ainvoke([
            SystemMessage(content="You are Matsya AI, a concise Telegram bot for Indian fishermen."),
            HumanMessage(content=prompt),
        ])
        text = response.content
        if isinstance(text, list):
            text = "\n".join(str(c) for c in text)
        return text.strip()
    except Exception as e:
        logger.error(f"Catch insights - LLM summary failed: {e}")
        # Fallback: raw stats
        lines = [
            f"📊 *Your Capture Insights*",
            f"🐟 Total catches: {total_catches} ({unique_species} species)",
        ]
        if top_species:
            lines.append(f"⭐ Top: {', '.join(s for s, _ in top_species[:3])}")
        if total_weight_kg > 0:
            lines.append(f"⚖️ Total weight: {total_weight_kg:.1f} kg")
        if total_value > 0:
            lines.append(f"💰 Est. value: ₹{total_value:,.0f}")
        return "\n".join(lines)
