# Change: Share the iOS saved-data banner

## Why

The regular app and shared pilot both display a SwiftUI banner when an iOS
request reads its saved copy. Use the shared Compose layer for the notice and
retain the iOS cached-response policy and timestamp formatting.

## What changes

- Render the saved-data notice in Compose using the existing iOS symbol.
- Expose the complete notice as one accessibility element.
- Verify that the regular app shows the notice for a saved profile and clears
  it after a live inbox request.

## Impact

- Affected spec: shared-mobile-build
- Affected code: shared Compose notices and the regular and pilot iOS shells
