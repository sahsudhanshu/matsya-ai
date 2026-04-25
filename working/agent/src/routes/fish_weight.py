"""
Fish weight estimation route - authenticated endpoint that:
  1. Calls the HuggingFace ML API for predicted weight
  2. Calculates weight via scientific formula W = a × L^b
  3. Asks Gemini for a structured analysis with price estimates

  POST /fish-weight/estimate
"""
from __future__ import annotations

import json
import os
import pathlib
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.utils.auth import TokenPayload, verify_token

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Load species constants from weight.json ──────────────────────────────────
_WEIGHT_JSON_PATH = pathlib.Path(__file__).resolve().parents[2] / "weight.json"
_SPECIES_CONSTANTS: dict[str, dict] = {}
try:
    with open(_WEIGHT_JSON_PATH, "r", encoding="utf-8") as f:
        _raw = json.load(f)
    for entry in _raw:
        _SPECIES_CONSTANTS[entry["common_name"].lower()] = entry
except Exception as exc:
    logger.warning(f"Failed to load weight.json: {exc}")


def _match_species(name: str) -> dict | None:
    key = name.strip().lower()
    if key in _SPECIES_CONSTANTS:
        return _SPECIES_CONSTANTS[key]
    for k, v in _SPECIES_CONSTANTS.items():
        if key in k or k in key:
            return v
    return None


# ── Request model ────────────────────────────────────────────────────────────

class FishWeightRequest(BaseModel):
    species: str
    length1: float
    length3: float
    height: float
    width: float


# ── Route ────────────────────────────────────────────────────────────────────

@router.post("/estimate")
async def estimate_fish_weight(
    body: FishWeightRequest,
    user: TokenPayload = Depends(verify_token),
):
    """Estimate fish weight via ML API + formula, then ask Gemini for analysis."""
    print(f"🐟  [ROUTE] /fish-weight/estimate called by user={user.sub} → species={body.species!r}")

    api_base = os.getenv("FISH_WEIGHT_API_URL")

    # ── 1. ML API call ───────────────────────────────────────────────────────
    ml_weight = None
    ml_mapped_species = None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{api_base}/predict_weight",
                json={
                    "species": body.species,
                    "length1": body.length1,
                    "length3": body.length3,
                    "height": body.height,
                    "width": body.width,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                ml_weight = data.get("predicted_weight_grams")
                ml_mapped_species = data.get("mapped_species")
                print(f"🐟  [ROUTE] ML API → weight={ml_weight}g")
            else:
                logger.warning(f"ML API error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"ML API request failed: {e}")

    # ── 2. Formula calculation ───────────────────────────────────────────────
    species_match = _match_species(body.species)
    if species_match:
        a = species_match["constant_a"]
        b = species_match["constant_b"]
    else:
        a, b = 0.01, 3.0

    formula_weight = round(a * (body.length3 ** b), 2)
    print(f"🐟  [ROUTE] Formula → W = {a} × {body.length3}^{b} = {formula_weight}g")

    # ── 3. Gemini analysis ───────────────────────────────────────────────────
    gemini_result = None
    try:
        google_api_key = os.getenv("GOOGLE_API_KEY", "")
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        if not google_api_key:
            raise ValueError("GOOGLE_API_KEY not set")

        import google.generativeai as genai
        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel(gemini_model)

        prompt = f"""You are a fisheries expert. I have estimated the weight of a fish using two methods:

Species: {body.species}
Matched species from database: {species_match['common_name'] if species_match else 'Unknown (using generic constants)'}
Measurements: Length1={body.length1}cm, Length3(total length)={body.length3}cm, Height={body.height}cm, Width={body.width}cm

Method 1 - ML Model Prediction: {ml_weight if ml_weight else 'unavailable'}g
Method 2 - Scientific Formula (W = a × L^b): {formula_weight}g (a={a}, b={b})

Based on these two weight estimates and the fish measurements, provide a JSON object with:
1. An approximated weight range taking into account both methods
2. The estimated market price range in INR based on current Indian fish market prices for this species

Return ONLY valid JSON, no markdown fences, no explanation:
{{
  "species": "<species name>",
  "estimated_weight_range": {{
    "min_grams": <number>,
    "max_grams": <number>
  }},
  "ml_predicted_weight_grams": <number or null>,
  "formula_calculated_weight_grams": <number>,
  "estimated_weight_grams": <best single estimate>,
  "market_price_per_kg": {{
    "min_inr": <number>,
    "max_inr": <number>,
    "market_reference": "<nearest market name>"
  }},
  "estimated_fish_value": {{
    "min_inr": <number>,
    "max_inr": <number>
  }},
  "quality_grade": "<Premium/Standard/Low based on measurements>",
  "notes": "<brief analysis note>"
}}"""

        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        gemini_result = json.loads(raw.strip())
        print(f"🐟  [ROUTE] Gemini analysis complete → {json.dumps(gemini_result, indent=2)[:300]}")

    except Exception as e:
        logger.error(f"Gemini analysis failed: {e}")
        # Build a fallback result without Gemini
        avg_weight = formula_weight
        if ml_weight:
            avg_weight = (ml_weight + formula_weight) / 2

        gemini_result = {
            "species": body.species,
            "estimated_weight_range": {
                "min_grams": round(min(ml_weight or formula_weight, formula_weight) * 0.9),
                "max_grams": round(max(ml_weight or formula_weight, formula_weight) * 1.1),
            },
            "ml_predicted_weight_grams": ml_weight,
            "formula_calculated_weight_grams": formula_weight,
            "estimated_weight_grams": round(avg_weight),
            "market_price_per_kg": {
                "min_inr": 150,
                "max_inr": 400,
                "market_reference": "Average Indian market",
            },
            "estimated_fish_value": {
                "min_inr": round(avg_weight / 1000 * 150),
                "max_inr": round(avg_weight / 1000 * 400),
            },
            "quality_grade": "Standard",
            "notes": "Gemini analysis unavailable; using fallback calculation.",
        }

    return {
        "success": True,
        "data": gemini_result,
    }
