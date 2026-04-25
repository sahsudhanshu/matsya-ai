# Bundled TFLite Models

This directory contains the TFLite models that are bundled directly into the app.

## Source

These models are copied from the `models/` directory in the repository root.
The source models are tracked in Git LFS.

## Usage

Models are loaded at runtime using `require()` statements in the code:

```typescript
const modelAsset = require("../assets/models/detection_float32.tflite");
```

The Metro bundler automatically handles `.tflite` files as assets and resolves
them to local URIs that can be loaded by `react-native-fast-tflite`.

## Models Included

- `detection_float32.tflite` - YOLOv8/v11 fish detection model (~12 MB)
- `Fish.tflite` - Species classification model (~43 MB)
- `Fish_disease.tflite` - Disease classification model (~43 MB)

## Updating Models

To update the models:

1. Replace the model files in the `models/` directory
2. Copy them to this directory: `cp models/*.tflite assets/models/`
3. Rebuild the app

The models will be automatically included in the app bundle.
