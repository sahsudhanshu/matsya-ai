# Matsya AI 🐟

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
│   ├── models/             # ✅ TFLite models (bundled for on-device inference)
│   └── ...                 # Icons, splash, fonts
├── components/             # Reusable UI components
│   └── ui/
├── lib/                    # Business logic & utilities
│   ├── detection.ts        # YOLO TFLite inference (bundled asset loading)
│   ├── tflite-inference.ts # Species & disease classification
│   ├── offline-inference.ts# Full offline pipeline (detect → classify → GradCAM)
│   ├── gradcam.ts          # GradCAM visual explanation
│   ├── api-client.ts       # Backend REST client (AWS API Gateway)
│   ├── auth-context.tsx    # AWS Cognito authentication
│   ├── network-context.tsx # Online/offline detection
│   ├── constants.ts        # Shared colours, fonts, config
│   ├── types.ts            # Shared TypeScript types
│   └── i18n/               # Internationalisation (6 languages)
├── models/                 # Source TFLite models
│   ├── detection_float32.tflite  (~12 MB)
│   ├── Fish.tflite               (~43 MB)
│   ├── Fish_disease.tflite       (~43 MB)
│   └── README.md
├── backend/                # Local Python dev server (FastAPI)
├── .gitattributes          # Git LFS rules for .tflite files
├── .gitignore
├── app.json                # Expo config
├── eas.json                # EAS Build config
└── package.json
```

---

## On-Device Models

The application comes with all necessary machine learning models bundled directly into the application assets. This ensures that features like fish detection, species identification, and disease analysis work **out-of-the-box** without any additional setup or internet connectivity.

### Bundled Models

- **Fish Detection**: `detection_float32.tflite`
- **Species Classification**: `Fish.tflite`
- **Disease Identification**: `Fish_disease.tflite`

No manual deployment via ADB is required for standard use or release builds.

---

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

MIT © Matsya AI contributors
