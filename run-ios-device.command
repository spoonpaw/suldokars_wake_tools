#!/bin/bash
# Double-click to launch Suldokar's Wake Tools on a plugged-in iPhone or iPad.
#
# Prereqs:
#   * iPhone / iPad connected via USB and trusted on this Mac
#   * Xcode installed; device shows up in Xcode > Devices and Simulators
#   * Apple Developer signing identity available
#       (configured in tauri.conf.json bundle.iOS.developmentTeam)
#
# If the build fails on signing, open the project in Xcode once to
# accept the provisioning profile, then re-run:
#   open backend/gen/apple/sw-tools-backend.xcodeproj
set -e
cd "$(dirname "$0")"
# Use LAN IP so the phone can reach the host's vite server.
export FORCE_LAN_IP=1
exec scripts/launch-dev.sh ios
