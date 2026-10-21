#!/bin/bash
set -euo pipefail
IOS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
BUILD_DIR="$IOS_ROOT/build"

mkdir -p "$BUILD_DIR"
xcodebuild -project "$IOS_ROOT/TailoredAgents.xcodeproj" -scheme TailoredAgents \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

# Package only our build output. Sideloadly supplies the user's signing profile.
PACKAGE_DIR="$(mktemp -d "$BUILD_DIR/package.XXXXXX")"
trap 'rm -rf "$PACKAGE_DIR"' EXIT
mkdir -p "$PACKAGE_DIR/Payload"
ditto "$BUILD_DIR/DerivedData/Build/Products/Release-iphoneos/TailoredAgents.app" \
  "$PACKAGE_DIR/Payload/TailoredAgents.app"
ditto -c -k --norsrc --keepParent "$PACKAGE_DIR/Payload" "$BUILD_DIR/TailoredAgents.ipa"
printf '\nReady for Sideloadly: %s\n' "$BUILD_DIR/TailoredAgents.ipa"
