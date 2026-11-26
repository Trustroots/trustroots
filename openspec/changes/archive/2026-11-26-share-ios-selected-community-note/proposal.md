## Why

A selected Community Note appears below the iOS offer map. Sharing the card's
presentation and close action makes this part of the map use Compose.

## What Changes

- Render the note text, source attribution, and Dismiss action in Compose.
- Use the native formatted publication date and existing note badge.
- Measure the card inside the map's safe-area inset and keep the four-line
  preview.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the selected iOS Community Note uses a shared card.

## Impact

Affects the Compose card and its iOS presentation. The native app handles map
selection, relay subscriptions and date formatting.
