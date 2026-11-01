## Why

Location lookups need a request's IP address temporarily. Moderation needs equality matching between accounts, which can use a keyed identifier instead of retaining the address.

## What Changes

- Replace `lastIpAddress` with `lastIpHash`, using HMAC-SHA-256 and a dedicated deployment secret.
- Canonicalise IPv4, IPv6 and IPv4-mapped IPv6 before hashing.
- Keep raw request addresses available for transient location lookup; do not add location lookup or change stored locations.
- Replace admin address displays and raw-address searches with matching by identifier.
- Pseudonymise the acting staff address in new audit records and remove historical raw address fields and legacy IP search payloads during migration.
- Update the privacy disclosure and revision history to reflect keyed account identifiers.
- Provide an idempotent, dry-run-first migration and deployment instructions. Infrastructure logs and backups require separate retention handling.

## Capabilities

### New Capabilities

- `ip-data-minimisation`: Request address handling, persisted identifiers and migration.

### Modified Capabilities

- `admin-moderation`: Match by keyed identifier and adjust stored audit details.

## Impact

Users, admin, core and pages modules change. The admin matching API and bookmarked address URLs change. Deployments must configure a dedicated secret before enabling matching; without it, collection is disabled. A maintenance script converts existing user addresses and removes legacy audit data. Rotation invalidates old identifiers, which must be cleared before collecting replacements. The existing MaxMind map-default-location endpoint already reads directly from the request and remains unchanged. This change does not establish a retention period.
