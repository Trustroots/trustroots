## Why

Ride popups show journey details but omit the hitchhikers already supplied by Hitchwiki Maps.

## What Changes

- Show named hitchhikers in popup facts, linking to existing Hitchwiki.org user pages with Hitchwiki Maps profiles as the fallback.
- Keep Anonymous entries as plain text and omit missing or malformed names.
- Support safely rendered lists of links in shared circle map facts.

## Impact

Changes affect tribes client parsing, map popups, profile-page lookup and tests. No migration or new dependency is required. Existing ride links and facts remain available during lookup failures.
