# Add official station artwork to Radio

## Why

Station rows are easier to scan when they carry recognisable artwork. Curated
official artwork can improve the catalogue while a reliable initials fallback
keeps every row readable when artwork is unavailable or fails to load.

## What Changes

- Add curated HTTPS artwork metadata for stations where official artwork is
  available, including SomaFM and other catalogue stations.
- Show available artwork in station rows, including category and favourite
  rows.
- Show initials derived from the station title when artwork is absent or fails
  to load.

## Impact

- Affected module: `modules/tribes` Radio catalogue and station-list interface.
- Metadata and presentation only; station IDs, stream URLs, playback, and
  Nostr events remain unchanged. No data migration or deployment sequencing is
  required.
