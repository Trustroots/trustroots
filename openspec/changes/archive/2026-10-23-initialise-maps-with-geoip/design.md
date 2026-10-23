# Design

## Initial viewport precedence

Search uses the following order:

1. An explicit destination: search result, URL coordinates/bounds or selected
   offer deep link.
2. A valid saved search viewport changed by the member less than 48 hours ago.
3. A valid approximate GeoIP viewport.
4. The existing `DEFAULT_LOCATION` fallback.

Hosting and meeting editors use their existing offer location first, then the
approximate viewport, then the existing fallback. They do not inherit the
search map's saved viewport: the member may have been browsing another country.
An explicit place search, click or drag chooses the offer location through the
existing editor contract. Initialisation, GeoIP resolution, zoom-only events
and programmatic map moves never select a location or create a marker.

GeoIP must not move the map after a member searches, pans, zooms or chooses a
location. Ignore a late response after any such action, after a higher-priority
destination arrives, or after unmount. Apply this to vector and raster maps.
Do not trigger browser geolocation permission prompts.

## Saved search positions

Version the stored viewport and include a `savedAt` timestamp. Validate finite
latitude/longitude, their geographic ranges, the renderer-supported zoom range
and the timestamp before use. Missing, malformed, future-dated, legacy or
48-hour-old records are treated as absent and cleared where storage is usable.

Only deliberate member viewport changes refresh `savedAt`, including explicit
place searches. Initial rendering, GeoIP/default centring and restoring a saved
viewport do not refresh it. Retain the existing debouncing. A valid record is
not discarded on the map's 48-hour anniversary while the member is already
using it; expiry is evaluated on the next initialisation. Storage failures
must leave the map usable.

## Data source decision

Use MaxMind's downloadable GeoLite City MMDB data and the MIT-licensed
`maxmind` Node reader, with the dependency version pinned during implementation.
The City edition supplies coordinates and an accuracy radius; a country-only
database would need a separate maintained country-centroid dataset. This is a
local lookup, with IPv4 and IPv6 support, and avoids transmitting visitor IPs
to a geolocation API. Do not add an automatic database-download dependency.

MaxMind requires an account and download credentials. Database terms are
separate from the reader's software licence. Operators must confirm the
applicable use/update requirements and provide the required attribution before
activation. The implementation must document the wording and placement.

Primary references checked on 23 October 2026:

- [GeoLite formats, accuracy and account requirements](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/).
- [Official database update guidance](https://dev.maxmind.com/geoip/updating-databases/).
- [Node reader API, IPv6, cache and update options](https://github.com/runk/node-maxmind).

## Server contract and isolation

Add authenticated `GET /api/map-default-location` in core. It takes no supplied
IP parameter and uses `getClientIpAddress(req)`, which understands Passenger's
special client-address header. Do not broaden Express proxy trust or trust
ordinary forwarding headers to implement this feature. Normal authentication
failures retain existing API behaviour.

For authenticated requests return either `{ location: { latitude, longitude,
zoom } }` or `{ location: null }`, with `Cache-Control: private, no-store`.
Reject invalid/non-public addresses before lookup, including loopback, private,
link-local and IPv4-mapped equivalents. Validate lookup coordinates and accuracy
radius. Round coordinates to whole degrees and cap zoom at 6; zoom out further
when needed to encompass the accuracy radius. Missing coordinates/radius,
invalid results, unknown addresses or database failures return null. A valid
zero latitude or longitude is accepted.

The client requests this endpoint only when a higher-priority initial viewport
is absent. Share an in-flight request across map consumers, but do not persist
the response in browser storage or reuse it across account changes. Network or
authentication errors simply leave the fallback usable.

Never add visitor-specific coordinates to shared `app.locals.appSettings`.
Do not store IP-derived coordinates on members/offers, retain IP-to-location
caches or add visitor IPs/coordinates to logs. Reader caches may contain bounded
decoded database records, not a new per-visitor cache. Operational logs may
report database availability/build age without visitor data.

## Provisioning and resource limits

Configure an optional `geoip.databasePath` in server configuration. With no path,
skip reader initialisation and return null. Open one reader per web process
outside the request path, use an explicitly bounded decode cache and keep the
worker from loading the database. Bad/missing database files must not prevent
application startup or trigger repeated opens on each request.

Provision a read-only database mount outside the repository/image. Run
`geoipupdate` separately with operator-managed credentials, check daily for
updates, validate the downloaded file and atomically replace it. Use controlled
web-process restarts to load the new database; no file watcher is needed in the
first implementation. Document update monitoring and how obsolete copies are
removed in accordance with the applicable terms. If the updater fails, retain
a still-permitted usable copy, or disable lookups when it can no longer be used.

Before activation, measure cold-load time, lookup latency and RSS/heap/external
memory with the actual database on Node 24. Report both one-process overhead
and aggregate overhead at the configured Passenger process count, including
overlap during restart. Do not claim that MMDB access is memory-mapped or free:
the reader can retain database buffers. Production capacity must accommodate
the measured overhead before the configured path is enabled.

## Verification and rollout

Use synthetic lookup responses and anonymous MMDB test records; do not copy
member reports, real visitor IPs or production databases into fixtures.

Server tests cover address provenance, IPv4/IPv6/reserved ranges, rounding,
accuracy/zoom, zero coordinates, malformed/missing data, reader failures,
authentication, no-store headers and isolation between concurrent requests.
Client tests cover precedence, 48-hour boundaries, storage migration/failures,
account changes, late responses and explicit offer selection for both renderers.
Browser tests cover fresh search, recent/expired saved viewports, explicit
destinations, lookup failure, and hosting/meeting location selection.

Run `pnpm check`, relevant server tests, full client/server coverage checks,
the browser suite and the production build before implementation readiness.
Keep existing 100% coverage and existing e2e cases. Use `pnpm install` after
switching branches and pnpm for dependency/lockfile updates.

Exercise the endpoint through the production-equivalent Nginx/Passenger chain
with controlled source addresses. Confirm the visitor rather than proxy address
is used and forged forwarding headers do not affect it. A localhost-only test
does not complete the deployment check. Deploy with the path unset, provision
and verify updates/attribution/resources, then enable the path and smoke-test
search and both editors. Archive the proposal and update the living offers and
search specification after implementation and verification are complete.
