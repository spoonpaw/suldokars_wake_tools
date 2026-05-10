#!/bin/bash
# Double-click to launch Suldokar's Wake Tools in an Android emulator.
#
# Prereqs:
#   * Android Studio installed
#   * At least one AVD (Android Virtual Device) created
#       (Android Studio > Device Manager > Create Device)
#   * NDK 28 installed via SDK Manager
set -e
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -z "${NDK_HOME:-}" ]; then
  NDK_HOME=$(ls -d "$ANDROID_HOME"/ndk/* 2>/dev/null | sort -V | tail -1)
  export NDK_HOME
fi
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

cd "$(dirname "$0")"

# Boot first AVD if none running
if [ -z "$(adb devices | grep -E '^emulator-')" ]; then
  AVD=$(emulator -list-avds 2>/dev/null | head -1)
  if [ -n "$AVD" ]; then
    echo "==> booting emulator: $AVD"
    nohup emulator -avd "$AVD" >/dev/null 2>&1 &
    echo "==> waiting for emulator..."
    adb wait-for-device
  else
    echo "No AVDs found. Open Android Studio > Device Manager and create one."
    read -n 1
    exit 1
  fi
fi

exec scripts/launch-dev.sh android
