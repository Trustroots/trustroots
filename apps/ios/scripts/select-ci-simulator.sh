#!/usr/bin/env bash
set -euo pipefail

# The runner may list simulators from an Xcode newer than the selected toolchain.
sdk_version="$(xcrun --sdk iphonesimulator --show-sdk-version)"
runtime="com.apple.CoreSimulator.SimRuntime.iOS-${sdk_version//./-}"

runtime_available() {
  xcrun simctl list runtimes -j | jq -e --arg id "$runtime" \
    'any(.runtimes[]; .identifier == $id and .isAvailable)' >/dev/null
}

if ! runtime_available; then
  xcodebuild -downloadPlatform iOS -buildVersion "$sdk_version" >&2
fi
if ! runtime_available; then
  echo "::error::The iOS $sdk_version simulator runtime is unavailable." >&2
  exit 1
fi

if device="$(xcrun simctl list devices available -j | jq -er --arg id "$runtime" \
  'first(.devices[$id][]? | select(.name | startswith("iPhone")) | .udid)')"; then
  printf '%s\n' "$device"
else
  xcrun simctl create "Trustroots CI iPhone" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro "$runtime"
fi
