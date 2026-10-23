## Why

Members who cannot host need to update their location and opt into meeting travellers without creating a dated meetup (#3346).

## What Changes

- Add an opt-in Happy to meet toggle independent of hosting status.
- Save both states atomically on the existing host/location offer and show both on profiles and search result cards.
- Include opted-in non-hosts in meeting discovery with existing meeting markers; retain host-only discovery and add a meeting filter.
- Explain visibility and use the existing location picker, offer API, fuzzing and circle restrictions.

## Capabilities

### New Capabilities

- `ongoing-meeting-availability`: Independent meeting availability at a member's saved approximate location.

## Impact

Affects offers and search modules. Existing meet offers require an expiry (the API supplies one even when omitted), so they represent dated meetups. Ongoing availability instead extends the existing non-expiring location offer with `happyToMeet`, default false. This avoids duplicate location entry and cross-offer synchronisation. Dated meetups remain independently located and dated. No migration or deployment configuration is needed; missing flags remain opted out.
