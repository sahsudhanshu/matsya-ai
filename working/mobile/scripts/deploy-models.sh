#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-models.sh
#
# Copies TFLite model files from the repo's models/ directory to the app's
# internal storage on an Android device/emulator via ADB.
#
# Requirements:
#   - Android device connected via USB (or emulator running)
#   - ADB in your PATH
#   - App already installed in DEBUG mode (release builds block run-as)
#
# Usage:
#   ./scripts/deploy-models.sh [PACKAGE_NAME]
#
#   PACKAGE_NAME defaults to com.aiforbharat.oceanai
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PACKAGE="${1:-com.aiforbharat.oceanai}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODELS_DIR="$REPO_ROOT/models"

MODELS=(
  "detection_float32.tflite"
  "Fish.tflite"
  "Fish_disease.tflite"
)

# ── Helpers ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} $*"; }
error()   { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────

if ! command -v adb &>/dev/null; then
  error "adb not found. Install Android platform-tools and add to PATH."
  exit 1
fi

ADB_DEVICES=$(adb devices | grep -v "^List" | grep "device$" | wc -l)
if [[ "$ADB_DEVICES" -eq 0 ]]; then
  error "No Android device/emulator connected."
  error "Connect a device via USB (enable USB Debugging) or start an emulator."
  exit 1
fi

info "Found $ADB_DEVICES device(s). Using first available."
echo ""

# ── Create models directory in app storage ────────────────────────────────────

info "Creating models directory in app storage..."
adb shell run-as "$PACKAGE" mkdir -p files/models 2>/dev/null || {
  error "Cannot access package '$PACKAGE' via 'adb shell run-as'."
  error "Make sure the DEBUG build is installed (release builds block run-as)."
  exit 1
}
success "Directory ready: files/models/"
echo ""

# ── Deploy each model ─────────────────────────────────────────────────────────

DEPLOYED=0
FAILED=0

for MODEL in "${MODELS[@]}"; do
  SRC="$MODELS_DIR/$MODEL"

  if [[ ! -f "$SRC" ]]; then
    warn "Skipping $MODEL - not found at $SRC"
    ((FAILED++))
    continue
  fi

  SIZE=$(du -sh "$SRC" | cut -f1)
  info "Deploying $MODEL ($SIZE) ..."

  # 1. Push to /data/local/tmp/ - world-readable, accessible by run-as processes.
  #    /sdcard/ (scoped storage on Android 11+) is NOT readable by run-as.
  TEMP_PATH="/data/local/tmp/${MODEL}"
  adb push "$SRC" "$TEMP_PATH" >/dev/null

  # 2. Copy from temp into app's internal files/models/ via run-as, then clean up.
  # Pass a single string to adb shell so Android's sh receives the full compound
  # command as one argument to sh -c (multi-arg form splits on && prematurely).
  adb shell "run-as $PACKAGE sh -c 'cp $TEMP_PATH files/models/${MODEL}'"
  adb shell "rm -f $TEMP_PATH"

  # Verify
  EXISTS=$(adb shell run-as "$PACKAGE" test -f "files/models/${MODEL}" && echo yes || echo no)
  if [[ "$EXISTS" == "yes" ]]; then
    success "✓ $MODEL deployed"
    DEPLOYED=$((DEPLOYED + 1))
  else
    error "✗ $MODEL failed to deploy"
    FAILED=$((FAILED + 1))
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────────────"
if [[ "$FAILED" -eq 0 ]]; then
  success "All $DEPLOYED model(s) deployed successfully! ✓"
  echo ""
  info "The app will load models from:"
  info "  files/models/ (app internal storage)"
  echo ""
  info "To verify deployment:"
  echo "  adb shell run-as $PACKAGE ls -lh files/models/"
else
  warn "$DEPLOYED deployed, $FAILED failed."
  error "Re-run after fixing the issues above."
  exit 1
fi
