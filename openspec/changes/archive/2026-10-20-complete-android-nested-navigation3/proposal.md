## Why

The authenticated Android shell now records top-level tab visits with
Navigation 3, but most routes inside each tab still live in unrelated Compose
state. Back therefore depends on which screen installed the active handler,
and opening the same profile or conversation from different places can return
to the wrong parent. Issue 3234 calls for predictable origin-aware Back across
toolbar and system navigation.

## What Changes

- Extend Navigation 3 ownership from top-level tab visits to the nested member
  flows in Circles, Search/map, Messages and Profile/menu, including embedded
  browser pages.
- Represent Search's Map/Members modes and selected map-host details as typed
  child routes; keep Search ViewModels under the real shell Search visit and
  give each HostDetail entry its own data-owning ViewModel.
- Give each top-level visit its own child back stack so returning to a tab
  restores that visit's route and origin. Represent screen transitions as
  typed, serialisable route keys with unique entry identities.
- Route toolbar Back, system Back and predictive Back through the same active
  child stack before the top-level stack, and keep form leave guards in front
  of every committed push or pop.
- Keep map filters, dialogs, sheets, text input and other transient UI state
  with their owning route; use entry-scoped saveable state and ViewModels for
  screen state that must survive route changes and activity recreation. Render
  HostDetail with a Navigation 3 overlay scene so the original map remains
  visible and retains its camera, filters and note-source lifecycle.
- Preserve existing route-reset actions on tab reselection, alert-driven
  conversation entry, analytics, session ownership and screen behaviour.
- Give a conversation opened from a profile its own decorated
  `ProfileConversationVisit(memberID, visitID)` and independent
  `MessageConversationEntryScreen` ViewModel; keep its exact profile origin
  below it. Route the contact-request WebView through a decorated profile
  browser entry whose purpose and public identifiers derive title and URL at
  runtime while credentials and private payloads stay out of saved state.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify nested Navigation 3 route ownership,
  origin-aware Back, restoration, leave guards and per-flow history.

## Impact

- Android Compose navigation and screen state under `apps/android`.
- Android instrumentation journeys for nested origin, Back, restoration,
  tab reselection and alert navigation.
- No server, web, iOS, wire-format or persistent account-data changes. Saved
  navigation state remains local Android saved state and contains only route
  identifiers and ordinary UI state, never session credentials.
