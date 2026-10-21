#!/bin/bash
set -euo pipefail
IOS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
mkdir -p "$IOS_ROOT/build"
xcrun --sdk macosx swiftc "$IOS_ROOT/TailoredAgents/AppPolicy.swift" \
  "$IOS_ROOT/Tests/PolicyTests.swift" -o "$IOS_ROOT/build/policy-tests"
"$IOS_ROOT/build/policy-tests"
