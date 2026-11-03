#!/usr/bin/env bash
set -euo pipefail
URL="${CAPTURE_URL:?CAPTURE_URL is required}"
OUT="${CAPTURE_DIR:?CAPTURE_DIR is required}"
[[ "$URL" == http://* || "$URL" == https://* ]] || { echo 'CAPTURE_URL must be an absolute HTTP(S) URL.' >&2; exit 1; }
[[ "$OUT" == /* ]] || { echo 'CAPTURE_DIR must be absolute.' >&2; exit 1; }
run() { /usr/bin/time -p "$@"; }
run mkdir -p "$OUT"
SESSION="capture-$$"
cleanup() { /usr/bin/time -p playwright-cli -s="$SESSION" close >/dev/null 2>&1 || true; }
trap cleanup EXIT
if ! run playwright-cli -s="$SESSION" open "$URL" --headed --browser chrome; then
  echo 'Browser could not open the capture URL.' >&2
  exit 75
fi
run sleep 2
if ! run playwright-cli -s="$SESSION" eval '(() => { const c=document.querySelector("canvas#game"); if (!document.title.includes("Miguel") || !document.querySelector(".game-shell, .shell") || !c || c.width < 100 || c.height < 100) throw new Error("Game content did not render"); return "RENDER_OK" })()'; then
  echo 'The page opened, but the game did not render correctly.' >&2
  exit 1
fi
if ! run playwright-cli -s="$SESSION" screenshot --filename="$OUT/final-desktop.png"; then
  echo 'Desktop screenshot capture failed.' >&2
  exit 75
fi
if ! run playwright-cli -s="$SESSION" resize 390 844; then
  echo 'Could not resize the browser for the mobile capture.' >&2
  exit 75
fi
run sleep 1
if ! run playwright-cli -s="$SESSION" screenshot --filename="$OUT/final-mobile.png"; then
  echo 'Mobile screenshot capture failed.' >&2
  exit 75
fi
run test -s "$OUT/final-desktop.png"
run test -s "$OUT/final-mobile.png"
echo "Captured desktop and mobile views from $URL into $OUT"
