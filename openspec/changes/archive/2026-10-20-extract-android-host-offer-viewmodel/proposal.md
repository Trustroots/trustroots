## Why

The Android Host offer editor currently owns profile and offer requests, form
values, validation, save behaviour and status text inside a composable. That
state is difficult to exercise independently and can restart work when the
screen is recreated. The Host menu destination already has its own Navigation 3
entry, so the offer form can use that entry's lifecycle for stable state and
request ownership.

## What Changes

- Move Host offer loading, editing, validation, save snapshots and outcomes to
  an immutable-state `HostOfferViewModel` with explicit events and an
  injectable repository.
- Scope the ViewModel to the existing Host menu Navigation 3 entry, preserving
  form state and in-flight work through Activity recreation and clearing it
  when the entry is removed.
- Keep API failure metadata context-free in state and resolve translated load
  and save errors from XML resources when rendered. Represent successful save
  feedback with status identity and resolve its XML text at render time.
- Preserve the existing profile-then-offer load flow, form defaults,
  HTML-to-editable-text normalisation, validation, save payload, returned offer
  ID, session invalidation and form leave guards.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: Host offer state is owned by its Navigation 3
  entry and survives Activity recreation without retaining credentials in
  navigation keys or UI state.

## Impact

- Affects the Android Host offer screen, its entry-scoped state holder and
  native unit and journey tests.
- No server, API contract, database or persisted-data change is required.
- The repository/platform boundary will normalise API HTML into editable text;
  the ViewModel will not depend on Android `Context` or hold session
  credentials.
