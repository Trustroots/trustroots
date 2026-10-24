# Initialise maps with approximate GeoIP location

## Why

[Issue #126](https://github.com/Trustroots/trustroots/issues/126) remains open:
fresh search, hosting and meeting maps start near Stuttgart regardless of the
member's location. Search remembers its viewport indefinitely, which can also
be confusing after travelling. Explicit offer-location selection already
prevents silently saving the initial map centre; preserve that protection.

## What Changes

- Use an approximate IP-derived location for the initial viewport when no
  explicit destination, existing offer location or recent search viewport applies.
- Expire saved search viewports after 48 hours without a member viewport change.
- Read a locally provisioned GeoLite City MMDB database through the `maxmind`
  Node package, with no external geolocation request during member requests.
- Expose a minimal, authenticated, non-cacheable default-location endpoint.
- Keep map centring separate from choosing an offer location, and preserve the
  existing fallback when the feature is unavailable.

## Affected Modules

- `modules/core`: optional lookup service, endpoint, configuration types and
  shared client access to the approximate viewport.
- `modules/search`: viewport precedence, expiring local storage and both map
  renderers.
- `modules/offers`: initial hosting/meeting viewport without selecting a marker.
- Deployment documentation/configuration: database provisioning, updates,
  attribution, memory measurements and Passenger/Nginx verification.
- Client/server tests and `tests/e2e`: deterministic, anonymous lookup fixtures
  and browser scenarios.

## Compatibility and Deployment

The endpoint is additive. No MongoDB migration is required. Legacy saved
search positions lack timestamps and will be discarded once rather than being
treated as fresh. Existing offer coordinates and explicit destinations retain
precedence. Cross-module imports must be checked against the module graph; any
new link must be justified and recorded using `pnpm modules:update-baseline`.

GeoIP is optional and disabled until a database path is configured. Operators
must provision the database and credentials for its separate updater, confirm
the applicable terms and attribution, and measure aggregate Passenger memory
before enabling it. The database and download credentials are excluded from
source, browser bundles and published images. Rollback disables the configured
path or deploys the previous application; existing offers require no rollback.
