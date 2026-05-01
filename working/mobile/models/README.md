# Matsya AI – On-Device TFLite Models

These are the pre-trained TensorFlow Lite models used for **on-device** fish
analysis. They are **bundled directly into the app** as assets and loaded at runtime.

> **Note:** Models are now **bundled inside the Android/iOS app** automatically.  
> No manual deployment via ADB is required. The models are copied to `assets/models/`
> and included in the app bundle during the build process.

## Models

| File                       | Size   | Purpose                            | Input                                            | Output                   |
| -------------------------- | ------ | ---------------------------------- | ------------------------------------------------ | ------------------------ |
| `detection_float32.tflite` | ~12 MB | Fish detection (YOLOv8/v11)        | `[1, 256, 256, 3]` float32 (RGB 0–1)             | `[1, 8, 1344]` float32   |
| `Fish.tflite`              | ~43 MB | Species classification (ResNet-18) | `[1, 224, 224, 3]` float32 (ImageNet normalised) | `[1, 31]` float32 logits |
| `Fish_disease.tflite`      | ~43 MB | Disease classification (ResNet-18) | `[1, 224, 224, 3]` float32 (ImageNet normalised) | `[1, 7]` float32 logits  |

## Class Labels

### Species (31 classes)

Bangus, Big Head Carp, Black Spotted Barb, Catfish, Climbing Perch,
Fourfinger Threadfin, Freshwater Eel, Glass Perchlet, Goby, Gold Fish,
Gourami, Grass Carp, Green Spotted Puffer, Indian Carp, Indo-Pacific Tarpon,
Jaguar Guapote, Janitor Fish, Knifefish, Long-Snouted Pipefish, Mosquito Fish,
Mudfish, Mullet, Pangasius, Perch, Scat Fish, Silver Barb, Silver Carp,
Silver Perch, Snakehead, Tenpounder, Tilapia

### Disease (7 classes)

Bacterial Red disease, Bacterial diseases (Aeromoniasis), Bacterial gill disease,
Fungal diseases (Saprolegniasis), Healthy Fish, Parasitic diseases,
Viral diseases (White tail disease)

## Development

The models in this directory are the source files. During development, they are
copied to `assets/models/` to be bundled with the app. The Metro bundler is
configured to handle `.tflite` files as assets.
