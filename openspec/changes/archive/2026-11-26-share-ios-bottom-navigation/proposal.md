# Change: Share regular iOS bottom navigation

## Why

The regular iOS app has a SwiftUI navigation bar beneath its shared and native
destinations. Use Compose for the four existing tabs while keeping iOS view
navigation, safe areas, and keyboard visibility in the host.

## What changes

- Render Home, Search, Messages and Menu in shared Compose.
- Keep the existing iOS symbols and selected-tab accessibility trait.
- Send taps through the existing destination and reselection logic.

## Impact

- Affected spec: shared-mobile-build
- Affected code: shared Compose navigation and the regular iOS app shell
