# Approximate initial map locations

Fresh search, hosting and meeting maps can use a coarse location inferred
locally from the member's IP address. This moves the viewport only. Members
still choose their offer location explicitly. Explicit destinations, existing
offer locations and recent search positions take precedence as described in
the offers and search specification. Search positions expire after 48 hours.

## Enablement

The feature is disabled by default. Provision a GeoLite City MMDB file outside
the checkout and container image, mount its directory read-only into the web
container and set `TRUSTROOTS_GEOIP_DATABASE_PATH` to the file's absolute path.
The same value can be set as `geoip.databasePath` in local server configuration.
Do not configure it for the worker: only web routes need the reader.

Deploy the application with the path unset first. Missing, unreadable or invalid
files leave the feature unavailable without preventing startup. Restart the web
processes after configuring or replacing the database. Each process opens the
database once, outside member requests, with a 1,000-record decode cache.

Obtain the data through an operator-owned MaxMind account. Confirm the current
[GeoLite terms and attribution requirements](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/)
before enabling it. The application displays attribution when it uses an
approximate viewport. The Node reader's MIT licence does not replace the
database's separate terms. Keep download credentials, production data and MMDB
files out of Git, public images and browser bundles.

## Updates

Run MaxMind's [GeoIP Update](https://dev.maxmind.com/geoip/updating-databases/)
separately from the application, using operator-managed account credentials.
Check daily for updates. Validate new files before atomically replacing the
database, then restart web processes to load the new copy. Mount the directory
rather than an individual file so replacements remain visible to containers.

Monitor update failures and database age. Retain a working copy only while its
use remains permitted by the applicable terms. Remove obsolete copies as those
terms require. Disable the configured path if an acceptable database cannot be
provided; no external geolocation service is used as a fallback.

## Activation checks

- On the production Node 24 platform, record the actual database edition,
  release date and file size, web-process count, cold-load time, lookup latency,
  and RSS/heap/external memory before and after opening and exercising it.
- Calculate aggregate memory at Passenger's maximum process count, including
  overlapping processes during restart. The reader retains database buffers;
  do not assume the file is memory-mapped or shared between processes. Confirm
  capacity before setting the database path in production.
- Through the actual Nginx/Passenger chain, use controlled client addresses to
  confirm visitor addresses reach the existing client-IP helper. Check IPv4,
  IPv6 and forged ordinary forwarding headers. A localhost-only test does not
  verify this deployment property. Do not broaden Express proxy trust.
- With an authenticated session, request `GET /api/map-default-location` and
  confirm `{ location: { latitude, longitude, zoom } }` or `{ location: null }`
  and `Cache-Control: private, no-store`. Reverse proxies must honour that
  response; the route must not be included in shared HTML/API caches.
- In a fresh browser, check search, new hosting and new meeting maps. Existing
  offer locations and explicit destinations must win. Zooming or the arrival
  of a default must not select a new offer location. Unknown/local addresses
  and unavailable data must leave a usable default map.

Production memory and proxy checks require the operator's database and
deployment; automated tests use synthetic records and stubbed lookup responses.
No production activation or database provisioning is performed by the PR.

## Privacy and rollback

Lookups use the existing trusted client-address helper, reject non-public
addresses, round coordinates to whole degrees and cap zoom at 6, widening for
the reported accuracy radius. No visitor address is sent to MaxMind during a
lookup. IP-derived locations are not written to member or offer records,
browser storage or application logs. Results are isolated per request and the
client shares only in-flight requests within the current authenticated session.

Unset `TRUSTROOTS_GEOIP_DATABASE_PATH` and restart web processes to disable the
feature, or deploy the previous application image. No MongoDB migration or
offer-coordinate rollback is needed. Untimestamped legacy browser search
positions are discarded once; rollback can still read newly saved positions
because latitude, longitude and zoom remain top-level fields.
