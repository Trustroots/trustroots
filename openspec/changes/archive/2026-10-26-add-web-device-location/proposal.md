## Why

Members can receive approximate GeoIP map defaults but cannot explicitly use their device location on the web. This leaves search centring (#2706) and hosting/meeting location selection (#703) dependent on manual input.

## What Changes

- Add an accessible, explicit “Use my location” action to map search and the shared hosting/meeting location editor.
- Share one-shot browser geolocation, pending state and actionable failure feedback in core client code.
- Centre search at zoom 13 while preserving filters; select editable offer coordinates without saving until the member chooses Save.
- Prevent delayed GeoIP defaults from overriding explicit device-location navigation.
- Keep manual selection, location randomisation and existing persistence behaviour.

## Impact

Affected modules: core, search and offers. No new API, database migration, dependency or deployment configuration. Browser location requires a secure context and member permission. Native apps and profile living/from fields remain outside this change. Addresses #2706 and part of #703.
