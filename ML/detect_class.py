import os
import uuid
import cv2
import torch
import torch.nn as nn
from torchvision import models, transforms
from ultralytics import YOLO 
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS


from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

# ================= CONFIG =================

STATIC_DIR = "static"
YOLO_OUT_DIR = os.path.join(STATIC_DIR, "yolo_outputs")
CROP_DIR = os.path.join(STATIC_DIR, "crops")
GRADCAM_DIR = os.path.join(STATIC_DIR, "gradcam")

os.makedirs(YOLO_OUT_DIR, exist_ok=True)
os.makedirs(CROP_DIR, exist_ok=True)
os.makedirs(GRADCAM_DIR, exist_ok=True)

YOLO_MODEL_PATH = "detection.pt"
SPECIES_MODEL_PATH = "Fish.pth"
DISEASE_MODEL_PATH = "Fish_disease.pth"

DEVICE = "cpu"
DROPOUT = 0.3006558931441291

# ================= LABEL MAPS =================

SPECIES_LABELS = {
    0: "Bangus", 1: "Big Head Carp", 2: "Black Spotted Barb",
    3: "Catfish", 4: "Climbing Perch", 5: "Fourfinger Threadfin",
    6: "Freshwater Eel", 7: "Glass Perchlet", 8: "Goby",
    9: "Gold Fish", 10: "Gourami", 11: "Grass Carp",
    12: "Green Spotted Puffer", 13: "Indian Carp",
    14: "Indo-Pacific Tarpon", 15: "Jaguar Guapote",
    16: "Janitor Fish", 17: "Knifefish",
    18: "Long-Snouted Pipefish", 19: "Mosquito Fish",
    20: "Mudfish", 21: "Mullet", 22: "Pangasius",
    23: "Perch", 24: "Scat Fish", 25: "Silver Barb",
    26: "Silver Carp", 27: "Silver Perch",
    28: "Snakehead", 29: "Tenpounder", 30: "Tilapia"
}

DISEASE_LABELS = {
    0: "Bacterial Red disease",
    1: "Aeromoniasis",
    2: "Bacterial Gill Disease",
    3: "Saprolegniasis",
    4: "Healthy Fish",
    5: "Parasitic Disease",
    6: "White Tail Disease"
}

NUM_SPECIES = len(SPECIES_LABELS)
NUM_DISEASES = len(DISEASE_LABELS)

# ================= APP =================

app = Flask(__name__, static_folder="static")
CORS(app)

_models = {}

# ================= MODEL LOADERS =================

def get_yolo():
    if "yolo" not in _models:
        _models["yolo"] = YOLO(YOLO_MODEL_PATH)
    return _models["yolo"]

def _build_resnet(num_classes, path):
    model = models.resnet18(weights=None)
    model.fc = nn.Sequential(
        nn.Dropout(DROPOUT),
        nn.Linear(model.fc.in_features, num_classes)
    )
    model.load_state_dict(torch.load(path, map_location=DEVICE))
    model.eval()
    return model

def get_species_model():
    if "species" not in _models:
        _models["species"] = _build_resnet(NUM_SPECIES, SPECIES_MODEL_PATH)
    return _models["species"]

def get_disease_model():
    if "disease" not in _models:
        _models["disease"] = _build_resnet(NUM_DISEASES, DISEASE_MODEL_PATH)
    return _models["disease"]

# ================= TRANSFORMS =================

img_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ================= HELPERS =================

def classify(model, pil_img):
    x = img_transform(pil_img).unsqueeze(0)
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1)
        conf, cls = torch.max(probs, 1)
    return int(cls.item()), float(conf.item())

def run_gradcam(model, pil_img, class_idx, filename_prefix):
    input_tensor = img_transform(pil_img).unsqueeze(0)

    cam = GradCAM(
        model=model,
        target_layers=[model.layer4[-1]]
    )

    targets = [ClassifierOutputTarget(class_idx)]
    grayscale_cam = cam(input_tensor=input_tensor, targets=targets)[0]

    rgb = np.array(pil_img).astype(np.float32) / 255.0
    rgb = cv2.resize(rgb, (256, 256))

    cam_img = show_cam_on_image(rgb, grayscale_cam, use_rgb=True)

    cam_name = f"{filename_prefix}.jpg"
    cam_path = os.path.join(GRADCAM_DIR, cam_name)
    cv2.imwrite(cam_path, cv2.cvtColor(cam_img, cv2.COLOR_RGB2BGR))

    return f"/static/gradcam/{cam_name}"

# ================= ROUTE =================

@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_id = str(uuid.uuid4())
    file = request.files["image"]

    img_np = cv2.imdecode(
        np.frombuffer(file.read(), np.uint8),
        cv2.IMREAD_COLOR
    )

    yolo = get_yolo()
    species_model = get_species_model()
    disease_model = get_disease_model()

    results = yolo(img_np)[0]
    annotated = img_np.copy()
    crops_map = {}

    for i, box in enumerate(results.boxes):
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        crop = img_np[y1:y2, x1:x2]

        if crop.size == 0:
            continue

        crop_name = f"{image_id}_{i}.jpg"
        cv2.imwrite(os.path.join(CROP_DIR, crop_name), crop)

        pil_crop = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))

        sp_cls, sp_conf = classify(species_model, pil_crop)
        ds_cls, ds_conf = classify(disease_model, pil_crop)

        species_cam = run_gradcam(
            species_model,
            pil_crop,
            sp_cls,
            f"{image_id}_{i}_species"
        )

        disease_cam = run_gradcam(
            disease_model,
            pil_crop,
            ds_cls,
            f"{image_id}_{i}_disease"
        )

        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        crops_map[f"crop_{i}"] = {
            "bbox": [x1, y1, x2, y2],
            "yolo_confidence": float(box.conf[0]),
            "species": {
                "label": SPECIES_LABELS[sp_cls],
                "confidence": sp_conf,
                "gradcam_url": species_cam
            },
            "disease": {
                "label": DISEASE_LABELS[ds_cls],
                "confidence": ds_conf,
                "gradcam_url": disease_cam
            },
            "crop_url": f"/static/crops/{crop_name}"
        }

    yolo_img_name = f"{image_id}_yolo.jpg"
    cv2.imwrite(os.path.join(YOLO_OUT_DIR, yolo_img_name), annotated)

    return jsonify({
        "yolo_image_url": f"/static/yolo_outputs/{yolo_img_name}",
        "crops": crops_map
    })

# ================= MAIN =================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860)