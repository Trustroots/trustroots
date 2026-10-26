## Why

Android profiles omit activity and reply facts that the existing profile API already provides and iOS already presents. Showing these facts in Android profiles and host search cards helps members assess whether a profile is active and responsive.

## What Changes

- Decode optional last-seen, reply-rate and reply-time values from existing member profile responses and preserve them when profiles are updated or retained in app state.
- Show labelled activity facts on Android member profiles and a compact last-active and reply-rate summary on host result cards.
- Handle missing or invalid values without presenting a missing reply rate as zero or blocking the rest of a profile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `native-android-member-app`: Android profile and host result surfaces present available activity and reply statistics.

## Impact

Only Android profile API decoding, profile and host result presentation, Android resources and their tests are affected. The existing server response is unchanged; there are no data migrations or new dependencies.
