# Design: Nostr hackerspace map

## Import

The server fetches only the fixed `https://api.spaceapi.io/` Collector endpoint after an administrator request. The returned index contains endpoint URLs, automated validation, last-seen times, and (for valid entries) SpaceAPI payloads. Normalize the complete directory response so invalid/unreachable entries remain distinguishable from removed entries. Treat endpoint and website URLs as untrusted display data and allow only valid HTTP(S) links.

The client presents a bulk preview. Valid entries with finite in-range latitude/longitude are included. A stable identifier is derived from the normalized SpaceAPI endpoint URL using SHA-256 and namespaced with `spaceapi:`. Invalid or unreachable entries retain their latest published event. Existing imported identifiers absent from the full directory response are updated to inactive; no event is deleted.

## Nostr event

Use NIP-41 draft kind `33000`, parameterized by the stable `d` identifier. Include `L=physical-location`, a `l` type label for `hackerspace`, `name`, optional `website`, structured `address`, `meta` values for source and source fetch time, and a coarse-to-fine ladder of standard lowercase `g` geohashes from one location point. Include optional Open Location Code tags for Trustroots display compatibility. Put a concise description in plain-text `content`. Preserve supported SpaceAPI description/contact/state fields as tags or metadata without publishing sensor/person identifiers. Include an explicit SpaceAPI-reported, not-human-verified marker. Inactive events retain their location and add inactive metadata.

The NIP-07 extension signs each event; Trustroots stores no secret key. Publish signed events to `wss://relay.trustroots.org`, reporting progress and per-event errors. Because NIP-07 signs one event at a time, the UI makes the number of approvals and progress clear.

## Public map

Subscribe to kind `33000` events labelled `hackerspace` or `makerspace`/`fablab` from the Trustroots relay. Decode only valid geohashes/coordinates and ignore inactive places by default, with an accessible option to show them. Use Leaflet with the project's raster map tiles so the circle page works without Mapbox WebGL. Make the map a prominent part of the circle hero so visitors see it above the fold, while keeping the circle introduction and membership actions visible. Markers show name, address, website, reported state and Trustroots fetch timestamp, alongside clear source and verification disclosures. Do not request browser geolocation.

## Circle member cards

Retain the existing contacts, recommenders and active-member groups and their membership logic. Replace the avatar-and-name rows with the shared member-search-card visual treatment and the same profile information (display name, username, living location, origin and tagline). Extract the card into a reusable component so search and circle pages share the rendering and accessibility behaviour.

## Access and failures

Protect import-preview and publishing-related API access with the admin policy. The public circle map is read-only and requires no account. Collector failure produces an admin error and does not alter published records. Relay failure yields a page-level unavailable/empty state and can be retried. A failed individual signature or publication does not stop later records; the result reports successes and failures.
