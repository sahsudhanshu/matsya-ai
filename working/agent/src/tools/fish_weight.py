"""
Fish weight estimation tool - estimates fish weight using an ML API and
the scientific length–weight relationship (W = a × L^b).

Loads species-specific constants (a, b) from weight.json and calls the
HuggingFace-hosted ML prediction endpoint for a second estimate.
"""
from __future__ import annotations

import json
import os
import pathlib
from typing import Optional

import httpx
from langchain_core.tools import tool

# ── Load species constants (a, b) from weight.json ──────────────────────────
_WEIGHT_JSON_PATH = pathlib.Path(__file__).resolve().parents[2] / "weight.json"

_SPECIES_CONSTANTS: dict[str, dict] = {}
try:
    with open(_WEIGHT_JSON_PATH, "r", encoding="utf-8") as f:
        _raw = json.load(f)
    for entry in _raw:
        _SPECIES_CONSTANTS[entry["common_name"].lower()] = entry
except Exception as exc:
    print(f"⚠ Failed to load weight.json: {exc}")


def _match_species(name: str) -> dict | None:
    """Fuzzy-match a species name against weight.json entries."""
    key = name.strip().lower()
    # Exact match
    if key in _SPECIES_CONSTANTS:
        return _SPECIES_CONSTANTS[key]
    # Partial match
    for k, v in _SPECIES_CONSTANTS.items():
        if key in k or k in key:
            return v
    return None


def _formula_weight(length3_cm: float, a: float, b: float) -> float:
    """W = a × L^b  (grams)."""
    return a * (length3_cm ** b)


@tool
async def estimate_fish_weight(
    species: str,
    length1: float,
    length3: float,
    height: float,
    width: float,
) -> str:
    """
    Estimate the weight of a fish using two methods:
    1. ML prediction API (HuggingFace hosted model)
    2. Scientific formula W = a × L^b (using species-specific constants)

    Args:
        species: Common name of the fish (e.g. 'Tilapia', 'Catfish', 'Bangus')
        length1: First body-length measurement in cm
        length3: Total length (head-to-tail) in cm
        height: Height of the fish in cm
        width: Width of the fish in cm
    """
    print(f"🐟  [TOOL] estimate_fish_weight called → species={species!r}, L1={length1}, L3={length3}, H={height}, W={width}")

    api_base = os.getenv("FISH_WEIGHT_API_URL", "")

    # ── 1. ML API prediction ─────────────────────────────────────────────────
    ml_weight = None
    ml_mapped_species = None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{api_base}/predict_weight",
                json={
                    "species": species,
                    "length1": length1,
                    "length3": length3,
                    "height": height,
                    "width": width,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                ml_weight = data.get("predicted_weight_grams")
                ml_mapped_species = data.get("mapped_species")
                print(f"🐟  [TOOL] ML API → weight={ml_weight}g, mapped_species={ml_mapped_species}")
            else:
                print(f"🐟  [TOOL] ML API error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"🐟  [TOOL] ML API request failed: {e}")

    # ── 2. Formula calculation ───────────────────────────────────────────────
    formula_weight = None
    species_match = _match_species(species)
    if species_match:
        a = species_match["constant_a"]
        b = species_match["constant_b"]
        formula_weight = round(_formula_weight(length3, a, b), 2)
        print(f"🐟  [TOOL] Formula → W = {a} × {length3}^{b} = {formula_weight}g (species: {species_match['common_name']})")
    else:
        # Fallback: use generic constants
        a, b = 0.01, 3.0
        formula_weight = round(_formula_weight(length3, a, b), 2)
        print(f"🐟  [TOOL] Formula (generic) → W = {a} × {length3}^{b} = {formula_weight}g")

    # ── Build result ─────────────────────────────────────────────────────────
    result = {
        "species": species,
        "matched_species": species_match["common_name"] if species_match else None,
        "ml_predicted_weight_grams": ml_weight,
        "ml_mapped_species": ml_mapped_species,
        "formula_weight_grams": formula_weight,
        "formula_constants": {"a": a, "b": b} if species_match else {"a": 0.01, "b": 3.0, "note": "generic fallback"},
        "measurements": {
            "length1_cm": length1,
            "length3_cm": length3,
            "height_cm": height,
            "width_cm": width,
        },
    }

    return json.dumps(result, ensure_ascii=False)
