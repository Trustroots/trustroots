## Design

Extract a shared CircleLocationMap for Leaflet setup, marker updates, safe text popups, loading/empty/error states and responsive styling. A shared hook owns a component's Nostr subscription, including late connection completion and unmount cleanup. Thin source adapters provide markers and explanatory text.

Hitchwiki uses kind 36820 addressable ride events. Query the official Hitchwiki publisher on `wss://relay.maps.hitchwiki.org`, with `since` seven days ago, and its kind 5 deletion requests. Accept the documented Hitchwiki family of sources. Select the latest version per author and d tag and respect matching author deletions. Filter recent origin arrival/departure times, falling back to submission_time for undated rides, and reject future times and invalid coordinates. RFC 9557 bracketed timezone suffixes are stripped before Date parsing. Display origin locations only; don't copy personal profiles or review text.

The seven-day window advances every minute while open. Marker popups link to the source ride and label the date used. Maps share their heading and status layout. Preserve the Hackers circle's existing disclosure and discovery links.

## Validation

Unit tests cover adapter filtering, replacement, deletions, safe popups, connection cleanup, errors, rolling time and shared rendering. E2E supplies a deterministic mocked WebSocket relay so no external network or signer is required, and verifies the public circle route, attribution, date disclosures, empty results and unavailable relay states. Marker construction and content filtering are covered by unit tests. A read-only live relay check also confirmed the documented publisher and recent ride format.
