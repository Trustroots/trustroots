# Read hackerspaces from both publication relays

## Why

Place events accepted by Nomadwiki are invisible on the Hackers circle because
the map and import preview currently read only the Trustroots relay.

## What Changes

- Read kind 33000 place events from both fixed publication relays.
- Merge duplicate events and retain the newest addressable version per author.
- Continue discovery when one relay cannot connect or closes its subscription.
- Show relay publication rejection reasons in the import UI.

## Impact

- Affected spec: hackerspaces.
- Affected code: Nostr place subscriptions, import preview and publication results.
