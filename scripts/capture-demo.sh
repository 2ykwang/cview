#!/usr/bin/env bash
# Capture each frame of assets/demo/demo.html into assets/screenshots/<name>.png
# at 2x scale. Requires Google Chrome / Canary / Chromium / Brave on macOS.
#
# Usage:
#   bash scripts/capture-demo.sh
#
# Override the browser path with $CVIEW_CHROME if needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEMO="file://$ROOT/assets/demo/demo.html"
OUT="$ROOT/assets/screenshots"
mkdir -p "$OUT"

# Pick a Chromium-compatible browser. Honor CVIEW_CHROME if set.
candidates=(
  "${CVIEW_CHROME:-}"
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
)
BROWSER=""
for c in "${candidates[@]}"; do
  [ -n "$c" ] && [ -x "$c" ] && BROWSER="$c" && break
done
if [ -z "$BROWSER" ]; then
  echo "No Chromium-compatible browser found. Set CVIEW_CHROME=/path/to/browser." >&2
  exit 1
fi
echo "Using: $BROWSER"

# Match .frame exactly so headless captures a tight crop.
W=1180
H=760

capture() {
  local n="$1" name="$2"
  echo "[$n] -> $OUT/$name.png"
  "$BROWSER" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size="$W,$H" \
    --force-device-scale-factor=2 \
    --default-background-color=00000000 \
    --screenshot="$OUT/$name.png" \
    "$DEMO?only=$n" 2>/dev/null
}

capture 1 list
capture 2 search
capture 3 chat
capture 4 chat-alt

echo
echo "Done. Output:"
ls -la "$OUT"/*.png 2>/dev/null
