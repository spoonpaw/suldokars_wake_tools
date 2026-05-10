#!/bin/bash
# Double-click to launch Suldokar's Wake Tools as a macOS desktop app (dev mode).
# Spawns vite on a free port + cargo tauri dev w/ matching devUrl.
set -e
cd "$(dirname "$0")"
exec scripts/launch-dev.sh desktop
