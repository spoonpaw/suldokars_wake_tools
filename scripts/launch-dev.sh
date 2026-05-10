#!/bin/bash
# Shared launcher core: pick a free port, start vite in the background,
# wait for it to bind, then exec cargo tauri dev with the matching devUrl.
#
# Args:
#   $1  = tauri target (e.g. 'desktop', 'ios', 'android')
#   $2+ = extra args appended after `cargo tauri <target> dev`
#         (e.g. '--target' 'aarch64-sim')
#
# Env in (optional):
#   FORCE_LAN_IP=1  -- use the host's LAN IP in devUrl instead of localhost
#                       (mobile-on-device variants set this so the phone
#                        can reach the host's vite server)
set -e

TARGET=${1:-desktop}
shift || true

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
BACKEND_DIR="$REPO_ROOT/backend"

PORT=$(node "$REPO_ROOT/scripts/find-free-port.cjs")
export VITE_PORT=$PORT

if [ "${FORCE_LAN_IP:-0}" = "1" ]; then
  HOST=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "0.0.0.0")
else
  HOST="localhost"
fi
DEV_URL="http://$HOST:$PORT"

echo "==> port:   $PORT"
echo "==> devUrl: $DEV_URL"
echo "==> target: $TARGET"
echo

# Start vite. Capture its PID so we can clean up on exit.
echo "==> starting vite..."
( cd "$FRONTEND_DIR" && VITE_PORT=$PORT npm run dev ) &
VITE_PID=$!
trap 'echo; echo "shutting down vite ($VITE_PID)..."; kill $VITE_PID 2>/dev/null || true' EXIT INT TERM

# Wait until vite binds the port (max 30s).
for i in $(seq 1 60); do
  if lsof -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "==> vite ready on port $PORT"
    break
  fi
  sleep 0.5
done

if ! lsof -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "vite failed to bind port $PORT after 30s"
  exit 1
fi

cd "$BACKEND_DIR"

case "$TARGET" in
  desktop)
    cargo tauri dev --config "{\"build\":{\"devUrl\":\"$DEV_URL\"}}" "$@"
    ;;
  ios)
    cargo tauri ios dev --config "{\"build\":{\"devUrl\":\"$DEV_URL\"}}" "$@"
    ;;
  android)
    cargo tauri android dev --config "{\"build\":{\"devUrl\":\"$DEV_URL\"}}" "$@"
    ;;
  *)
    echo "unknown target: $TARGET"
    exit 1
    ;;
esac
