#!/bin/bash
set -euo pipefail
IOS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
if [[ ! "${APPLE_TEAM_ID:-}" =~ ^[A-Z0-9]{10}$ || "${TA_APNS_ENVIRONMENT:-}" != development ]]; then
  printf '%s\n' 'Set APPLE_TEAM_ID to your paid Apple team and TA_APNS_ENVIRONMENT=development. This script builds a development app only.' >&2
  exit 1
fi
xcodebuild -project "$IOS_ROOT/TailoredAgents.xcodeproj" -scheme TailoredAgents \
  -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$IOS_ROOT/build/PushDerivedData" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" TA_APNS_ENVIRONMENT=development \
  CODE_SIGN_ENTITLEMENTS=TailoredAgents/Push.entitlements build
APP="$IOS_ROOT/build/PushDerivedData/Build/Products/Debug-iphoneos/TailoredAgents.app"
ENTITLEMENTS="$(codesign -d --entitlements - "$APP" 2>/dev/null)"
if ! printf '%s' "$ENTITLEMENTS" | /usr/bin/plutil -extract aps-environment raw -o - - | /usr/bin/grep -qx development; then
  printf '%s\n' 'The signed app does not have the expected push entitlement. Check the App ID and provisioning profile.' >&2
  exit 1
fi
printf '\nSigned development app (not published): %s\n' "$APP"
