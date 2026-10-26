## Why

Ride popups show journey details but omit the hitchhikers already supplied by Hitchwiki Maps.

## What Changes

- Show named hitchhikers in popup facts, linking directly to Hitchwiki Maps accounts.
- Keep Anonymous entries as plain text and omit missing or malformed names.
- Support safely rendered lists of links in shared circle map facts.

## Impact

Changes affect tribes client parsing, map popups and tests. No migration or new dependency is required. Existing ride links and facts remain available without any profile-page lookup.
