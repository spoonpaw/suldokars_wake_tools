#!/bin/bash
# Double-click to launch Suldokar's Wake Tools on a plugged-in Android phone or tablet.
#
# Prereqs:
#   * Android device with USB debugging enabled
#       (Settings > About > tap Build number 7x; then Developer options > USB debugging)
#   * Device plugged in via USB and authorized on this Mac
#       (accept the RSA fingerprint dialog on the device)
#   * Android Studio installed; NDK 28 available
set -e
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -z "${NDK_HOME:-}" ]; then
  NDK_HOME=$(ls -d "$ANDROID_HOME"/ndk/* 2>/dev/null | sort -V | tail -1)
  export NDK_HOME
fi
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

cd "$(dirname "$0")"

DEVICES=$(adb devices | awk 'NR>1 && /device$/ && !/emulator/ {print $1}')
if [ -z "$DEVICES" ]; then
  echo "No physical Android device detected via adb."
  echo "Plug it in, enable USB debugging, accept the RSA prompt on the device."
  echo "Then run: adb devices  -- and verify the serial appears."
  read -n 1
  exit 1
fi
echo "==> device(s): $DEVICES"

# Use LAN IP so the phone can reach the host's vite server.
export FORCE_LAN_IP=1
exec scripts/launch-dev.sh android
