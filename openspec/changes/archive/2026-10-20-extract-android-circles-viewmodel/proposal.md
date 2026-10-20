## Why

`CirclesScreen` currently owns catalogue loading, membership loading and
updates, filtering, detail selection, loading/error state, and authentication
failure handling in Compose-local state. A Navigation 3 entry-scoped
ViewModel will keep that screen's state and work with its navigation entry
while leaving rendering and parent-owned navigation callbacks in Compose.

## What Changes

- Move circle catalogue and membership operations, filtering, selected-circle
  state, loading/error state and membership updates into a Circles ViewModel
  with immutable UI state and explicit events.
- Scope the ViewModel to the active Navigation 3 entry using the existing
  `rememberViewModelStoreNavEntryDecorator` foundation.
- Preserve loaded circles, filter text and selected detail while the entry is
  temporarily off the stack; clear its state when its entry is removed.
- Reset to a fresh overview and reload when the member explicitly reselects
  Circles by replacing the active `MemberTabVisit` with a new visit. The
  current Compose `key(circlesNavigationID)` alone does not replace a
  Navigation 3 entry's ViewModel.
- Keep session invalidation as an acknowledged one-shot event delivered to the
  existing parent callback. Scope dependencies to the current signed-in
  account and never put session cookies in UI state or saved navigation keys.
- Keep Compose responsible for rendering, Back handling and shell navigation.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: define Circles state ownership, account-scoped
  lifetime, reload-on-reselection behaviour and membership/filter continuity.

## Impact

- Changes the Android Circles screen, its ViewModel and injectable repository
  boundary, plus Android unit and instrumentation journeys.
- Uses the lifecycle ViewModel and Navigation 3 entry-store foundation supplied
  by the sibling Navigation 3 change; no activity-global Circles ViewModel is
  introduced.
- Does not change server routes, API payloads, web or iOS behaviour, stored
  data or deployment requirements.
