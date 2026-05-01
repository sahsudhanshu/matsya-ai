import httpx
import os
from dotenv import load_dotenv
from pathlib import Path
import asyncio
import json
import pathlib

load_dotenv()


weight_json_path = pathlib.Path(__file__).resolve().parents[1] / "weight.json"
# print(weight_json_path)

Species_a_b: dict[str, dict] = {}


try:
    with open(weight_json_path, "r", encoding="utf-8") as f:
        _raw = json.load(f)
    for entry in _raw:
        Species_a_b[entry["common_name"].lower()] = entry
except Exception as exc:
    print(f" Failed to load weight.json: {exc}")


def match_specie(name: str) -> dict | None:
    key = name.strip().lower()
    if key in Species_a_b:
        return Species_a_b[key]
    for k, v in Species_a_b.items():
        if key in k or k in key:
            return v
    return None



def weight_by_formula(length3:float, a:float, b:float)-> float:
    return a * (length3 ** b)

async def fish_weight_calculation(species: str, length1: float, length3: float, height: float,width: float) -> str:
    try:
        async with httpx.AsyncClient() as client:
            api_base = os.getenv("FISH_WEIGHT_API_URL", "")
            response = await client.post(
                f"{api_base}/predict_weight",
                    json={
                        "species": species,
                        "length1": length1,
                        "length3": length3,
                        "height": height,
                        "width": width,
                    },
            )
            response.raise_for_status()
            response_json = response.json()
            # print(response_json)
    except httpx.RequestError as err:
        print(f"Couldn't fetch weight, reason: {err}")



    formula_weight=None
    specie_matched=match_specie(species)
    if specie_matched:
        a=specie_matched["constant_a"]
        b=specie_matched["constant_b"]
        formula_weight=weight_by_formula(length3, a, b)
    else:
        a, b = 0.01, 3.0
        formula_weight = round(weight_by_formula(length3, a, b), 2)


    ml_weight=response_json.get("predicted_weight_grams")
    ml_mapped_species=response_json.get("mapped_species")




    result= {
        "species": species,
        "matched_species": specie_matched["common_name"] if specie_matched else None,
        "ml_predicted_weight_grams": ml_weight,
        "ml_mapped_species": ml_mapped_species,
        "formula_weight_grams": formula_weight,
        "formula_constants": {"a": a, "b": b} if specie_matched else {"a": 0.01, "b": 3.0, "note": "generic fallback"},
        "measurements": {
            "length1_cm": length1,
            "length3_cm": length3,
            "height_cm": height,
            "width_cm": width,
        },
    }
    print(json.dumps(result, indent=2))
    return result


