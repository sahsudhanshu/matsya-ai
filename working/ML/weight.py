from flask import Flask, request, jsonify
import numpy as np
import joblib
from difflib import get_close_matches

# -----------------------------
# Load trained XGBoost model
# -----------------------------
model = joblib.load("xgboost_model (1).joblib")

# -----------------------------
# Species order (FIXED)
# -----------------------------
from flask_cors import CORS
SPECIES_ORDER = [
    "Bream",
    "Parkki",
    "Perch",
    "Pike",
    "Roach",
    "Smelt",
    "Whitefish"
]

# -----------------------------
# 31 → 7 mapping
# -----------------------------
SPECIES_MAPPING = {
    "Bangus": "Whitefish",
    "Big Head Carp": "Pike",
    "Black Spotted Barb": "Roach",
    "Catfish": "Pike",
    "Climbing Perch": "Perch",
    "Fourfinger Threadfin": "Whitefish",
    "Freshwater Eel": "Bream",
    "Glass Perchlet": "Smelt",
    "Goby": "Smelt",
    "Gold Fish": "Roach",
    "Gourami": "Perch",
    "Grass Carp": "Pike",
    "Green Spotted Puffer": "Roach",
    "Indian Carp": "Whitefish",
    "Indo-Pacific Tarpon": "Pike",
    "Jaguar Gapote": "Pike",
    "Janitor Fish": "Bream",
    "Knifefish": "Perch",
    "Long-Snouted Pipefish": "Smelt",
    "Mosquito Fish": "Smelt",
    "Mudfish": "Perch",
    "Mullet": "Bream",
    "Pangasius": "Pike",
    "Perch": "Perch",
    "Scat Fish": "Perch",
    "Silver Barb": "Bream",
    "Silver Carp": "Pike",
    "Silver Perch": "Perch",
    "Snakehead": "Pike",
    "Tenpounder": "Pike",
    "Tilapia": "Bream"
}

# -----------------------------
# Flask app
# -----------------------------
app = Flask(__name__)
CORS(app)


# -----------------------------
# Helper: species → index
# -----------------------------
def get_species_index(user_species: str):
    cleaned = user_species.strip().title()

    # Deterministic mapping first
    if cleaned in SPECIES_MAPPING:
        mapped = SPECIES_MAPPING[cleaned]
        return SPECIES_ORDER.index(mapped), mapped

    # Fallback: fuzzy match to 7 classes
    match = get_close_matches(cleaned, SPECIES_ORDER, n=1, cutoff=0.6)
    if match:
        return SPECIES_ORDER.index(match[0]), match[0]

    return None, None

# -----------------------------
# Health check
# -----------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

# -----------------------------
# Predict weight
# -----------------------------
@app.route("/predict_weight", methods=["POST"])
def predict_weight():
    data = request.get_json()

    required = ["species", "length1", "length3", "height", "width"]
    if not all(k in data for k in required):
        return jsonify({
            "error": "Missing fields",
            "required": required
        }), 400

    species_input = data["species"]
    length1 = float(data["length1"])
    length3 = float(data["length3"])
    height = float(data["height"])
    width = float(data["width"])

    species_index, mapped_species = get_species_index(species_input)

    if species_index is None:
        return jsonify({
            "error": "Species not supported",
            "input_species": species_input
        }), 400

    # Feature vector (MATCH TRAINING ORDER)
    X = np.array([[species_index, length1, length3, height, width]])

    predicted_weight = float(model.predict(X)[0])

    return jsonify({
        "input_species": species_input,
        "mapped_species": mapped_species,
        "species_index": species_index,
        "predicted_weight_grams": round(predicted_weight, 2)
    })

# -----------------------------
# Run
# -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)