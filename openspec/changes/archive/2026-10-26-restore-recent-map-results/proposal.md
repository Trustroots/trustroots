# Restore Recent Android Map Results

## Why

Opening Search creates a new tab visit, so its map ViewModel starts with an
empty viewport and no offers even when the member has just left Search.

## What Changes

- Share the latest successful map snapshot across Search tab visits for a short
  period, including the viewport, visible bounds, filters and offers.
- Show a recent snapshot immediately and refresh it in the background once its
  freshness window has expired.
- Scope snapshots to the active backend and member session, and preserve
  explicit Retry and new-bounds searches.

## Capabilities

- `native-android-member-app`: restore recent map results on a new Search visit.

## Impact

- A small in-memory cache owned by the authenticated shell and consumed by the
  Search map ViewModel.
- Native Android member-app living specification and regression tests.
