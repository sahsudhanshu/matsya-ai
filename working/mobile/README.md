# OceanAI – AI for Bharat 🐟

An offline-capable mobile app that helps Indian fishers identify fish species, detect diseases, and get market insights - all running **on-device** using TFLite models.

Built with **Expo (React Native)** + **react-native-fast-tflite** for GPU-accelerated inference.

---

## Features

| Feature                  | Description                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| 🔍 **Fish Detection**    | YOLOv8/v11 on-device detection (256 × 256 input)                          |
| 🐠 **Species ID**        | 31-class ResNet-18 classifier with ImageNet normalisation                 |
| 🏥 **Disease Detection** | 7-class ResNet-18 disease classifier                                      |
| 🌡️ **GradCAM**           | Visual explanation overlay for each prediction                            |
| 💬 **AI Assistant**      | Multi-lingual assistant (Hindi, Tamil, Telugu, Marathi, Bengali, English) |
| 🗺️ **Ocean Map**         | Fishing hotspots, safety alerts, live weather                             |
| 📊 **Analytics**         | Catch history, market price trends                                        |
| 🔒 **Offline-first**     | Inference works without internet; gracefully degrades online              |

---

## Repository Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Tab screens (home, chat, upload, map, settings, analytics)
│   ├── analysis/           # Technical analysis detail screen
│   └── auth/               # Login & registration
├── assets/
│   ├── models/             # EMPTY – models are NOT bundled (see models/ below)
│   └── ...                 # Icons, splash, fonts
├── components/             # Reusable UI components
│   └── ui/
├── lib/                    # Business logic & utilities
│   ├── detection.ts        # YOLO TFLite inference + model loading from device FS
│   ├── tflite-inference.ts # Species & disease TFLite inference
│   ├── offline-inference.ts# Full offline pipeline (detect → classify → GradCAM)
│   ├── gradcam.ts          # GradCAM visual explanation
│   ├── api-client.ts       # Backend REST client (AWS API Gateway)
│   ├── auth-context.tsx    # AWS Cognito authentication
│   ├── network-context.tsx # Online/offline detection
│   ├── constants.ts        # Shared colours, fonts, config
│   ├── types.ts            # Shared TypeScript types
│   └── i18n/               # Internationalisation (6 languages)
├── models/                 # ✅ TFLite models (bundled in app assets)
│   ├── detection_float32.tflite  (~12 MB)
│   ├── Fish.tflite               (~43 MB)
│   ├── Fish_disease.tflite       (~43 MB)
│   └── README.md
├── assets/
│   ├── models/             # Bundled TFLite models (copied from models/)
│   └── ...                 # Icons, splash, fonts
├── scripts/
│   └── deploy-models.sh    # (DEPRECATED - models now bundled in app)
├── backend/                # Local Python dev server (FastAPI)
├── .gitattributes          # Git LFS rules for .tflite files
├── .gitignore
├── app.json                # Expo config
├── eas.json                # EAS Build config
└── package.json
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **Android Studio** + Android SDK (for Android development)
- **Java 17** (for Gradle)
- An Android device (USB debug enabled) **or** an emulator

### 1 - Clone & install

```bash
git clone https://github.com/<your-org>/ai-for-bharat.git
cd ai-for-bharat/mobile
npm install
```

If you use Git LFS (recommended for the model files):

```bash
git lfs install
git lfs pull        # downloads models/ into working tree
```

### 2 - Environment setup

```bash
cp .env.example .env.local
# Fill in EXPO_PUBLIC_API_URL, EXPO_PUBLIC_COGNITO_USER_POOL_ID, etc.
# Leave EXPO_PUBLIC_API_URL empty to run in demo / mock-data mode.
```

### 3 - Generate native code (Expo CNG)

The `ios/` and `android/` folders are **not committed** - they are generated from
`app.json` at build time.

```bash
npx expo prebuild --clean
```

### 4 - Build & run

```bash
# Android
npm run android        # builds debug APK and launches on connected device/emulator

# iOS (macOS only)
npm run ios
```

---

## Deploying Models to Device (ADB)

Models are loaded at runtime from the app's **internal files directory**
(`DocumentDirectory/models/`). Use one of the approaches below to deploy them.

### Automated script (recommended)

```bash
# From mobile/
npm run deploy-models

# With a custom package name:
./scripts/deploy-models.sh com.aiforbharat.oceanai
```

The script:

1. Pushes each `.tflite` file from `models/` to `/sdcard/` on the device
2. Uses `adb shell run-as` to copy it into the app's internal `files/models/` directory
3. Cleans up the temporary `/sdcard/` copy

### Manual ADB commands

Replace `com.aiforbharat.oceanai` if you changed the package name in `app.json`.

```bash
# ── Step 1: Create the models directory in app internal storage ──
adb shell run-as com.aiforbharat.oceanai mkdir -p files/models

# ── Step 2: Deploy each model (repeat for all three) ──

# detection_float32.tflite  (~12 MB)
adb push models/detection_float32.tflite /sdcard/detection_float32.tflite
adb shell run-as com.aiforbharat.oceanai sh -c \
  'cp /sdcard/detection_float32.tflite files/models/detection_float32.tflite && rm /sdcard/detection_float32.tflite'

# Fish.tflite  (~43 MB)
adb push models/Fish.tflite /sdcard/Fish.tflite
adb shell run-as com.aiforbharat.oceanai sh -c \
  'cp /sdcard/Fish.tflite files/models/Fish.tflite && rm /sdcard/Fish.tflite'

# Fish_disease.tflite  (~43 MB)
adb push models/Fish_disease.tflite /sdcard/Fish_disease.tflite
adb shell run-as com.aiforbharat.oceanai sh -c \
  'cp /sdcard/Fish_disease.tflite files/models/Fish_disease.tflite && rm /sdcard/Fish_disease.tflite'

# ── Step 3: Verify ──
adb shell run-as com.aiforbharat.oceanai ls -lh files/models/
```

Expected output after verify:

```
-rw------- 1 u0_a... u0_a... 12.0M ... detection_float32.tflite
-rw------- 1 u0_a... u0_a... 43.0M ... Fish.tflite
-rw------- 1 u0_a... u0_a... 43.0M ... Fish_disease.tflite
```

### Re-deploying & troubleshooting

```bash
# Check if models exist on device
adb shell run-as com.aiforbharat.oceanai ls -lh files/models/

# Remove and re-deploy a specific model
adb shell run-as com.aiforbharat.oceanai rm files/models/Fish.tflite
# then re-push as above

# View live app logs (filter for model loading)
adb logcat | grep -i "TFLite\|Detection\|model"
```

> **Note:** `adb shell run-as` only works on **debug** builds.  
> For release builds, use a different delivery mechanism (e.g., download from server on first launch).

---

## On-Device Inference Pipeline

```
User picks image
       │
       ▼
 YOLO Detection          detection_float32.tflite
 (256×256, RGB 0-1)      → bounding boxes (NMS post-processing)
       │
       ▼ for each detected fish ...
 ┌─────────────────────────────────────────┐
 │  Crop from original image               │
 │              ▼                          │
 │  Species Classification                 │
 │  Fish.tflite (224×224, ImageNet norm)   │
 │              ▼                          │
 │  Disease Detection                      │
 │  Fish_disease.tflite (224×224, ImageNet)│
 │              ▼                          │
 │  GradCAM (visual explanation)           │
 └─────────────────────────────────────────┘
       │
       ▼
  Results + market estimates
```

---

## Git LFS Setup (for contributors)

The `models/*.tflite` files are tracked via **Git Large File Storage** to keep
the repository's main history lean.

```bash
# One-time setup
git lfs install

# Clone with models
git lfs clone https://github.com/<your-org>/ai-for-bharat.git

# Or, after a regular clone, pull LFS files
git lfs pull

# Check LFS status
git lfs ls-files
```

If you add or update model files:

```bash
git add models/new_model.tflite
git commit -m "feat(models): add new_model.tflite"
git push   # LFS uploads the binary automatically
```

---

## Environment Variables

| Variable                           | Required     | Description                                         |
| ---------------------------------- | ------------ | --------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`              | No           | Backend API Gateway URL. Leave empty for demo mode. |
| `EXPO_PUBLIC_COGNITO_USER_POOL_ID` | Yes (online) | AWS Cognito User Pool ID                            |
| `EXPO_PUBLIC_COGNITO_CLIENT_ID`    | Yes (online) | AWS Cognito App Client ID                           |

Copy `.env.example` to `.env.local` and fill in the values.

---

## Available NPM Scripts

| Script            | Description                               |
| ----------------- | ----------------------------------------- |
| `npm start`       | Start Metro bundler                       |
| `npm run android` | Build & run on Android device/emulator    |
| `npm run ios`     | Build & run on iOS simulator (macOS only) |

---

## Tech Stack

| Layer        | Technology                                                                          |
| ------------ | ----------------------------------------------------------------------------------- |
| Framework    | [Expo](https://expo.dev) 54 + React Native 0.81                                     |
| Navigation   | [Expo Router](https://expo.github.io/router) v6 (file-based)                        |
| ML Inference | [react-native-fast-tflite](https://github.com/mrousavy/react-native-fast-tflite) v2 |
| Maps         | react-native-maps                                                                   |
| Charts       | victory-native                                                                      |
| Auth         | Amazon Cognito (`amazon-cognito-identity-js`)                                       |
| i18n         | Custom context (EN, HI, TA, TE, MR, BN)                                             |
| Architecture | New Architecture enabled (`newArchEnabled: true`)                                   |

---

## Contributing

1. Fork the repo
2. Run `git lfs install` before cloning
3. Follow the Quick Start above
4. Make your changes; run `npx tsc --noEmit` to type-check before submitting a PR

---

## License

MIT © AI for Bharat contributors
