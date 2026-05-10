#!/bin/bash
# Double-click to launch Suldokar's Wake Tools in iOS Simulator (Apple Silicon).
set -e
cd "$(dirname "$0")"
exec scripts/launch-dev.sh ios --target aarch64-sim
