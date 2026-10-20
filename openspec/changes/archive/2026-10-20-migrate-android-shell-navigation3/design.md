## Context

`MemberShell` in `TrustrootsApp.kt` currently stores the selected
`Destination`, a list of previous destinations, menu subpage state, browser
state and per-tab reset counters separately. Its Back handler first dismisses
browser content, then returns from a menu subpage, then pops the manual tab
history. Notification and menu actions can navigate across tabs, and editable
forms install a shared leave guard before a navigation callback runs.

This change is the first logical slice of issue 3234. It migrates the four
top-level destinations to Navigation 3. Menu subpages, browser content,
profile-detail navigation and other flows inside a tab remain on their current
state model and are explicitly deferred to follow-up slices.

## Decisions

- Use `androidx.navigation3:navigation3-runtime:1.2.0` and
  `androidx.navigation3:navigation3-ui:1.2.0`, with `NavDisplay` as the
  top-level renderer and a saveable Navigation 3 back stack as the selected tab
  and its origin history.
- Add the Kotlin serialization plugin at 2.3.21 and
  `kotlinx-serialization-core:1.9.0` for serialisable keys. Add
  `androidx.lifecycle:lifecycle-viewmodel-navigation3:2.10.0` and apply its
  ViewModel entry decorator after Navigation 3's saveable-state decorator.
- Define a closed set of `@Serializable` top-level visit keys implementing
  `NavKey`. Each key contains a destination enum and a monotonically allocated
  visit identifier, but no member-specific arguments. Distinct visits to the
  same destination must have distinct entry identity so a history such as
  Circles → Messages → Circles remains three entries with independently
  restorable content. Runtime member/session objects, cookies, usernames,
  tokens and other credentials are supplied by the live authenticated shell
  after session loading and are never encoded into the back stack.
- Keep the current visible tab as the last entry. Selecting another tab pushes
  it, preserving the existing origin history; Back pops to the prior tab. Tab
  reselection continues to trigger the existing reset action without adding a
  duplicate history entry.
- Route Back through existing transient and nested state before popping the
  Navigation 3 stack. Form leave guards wrap every navigation action so a
  pending discard decision remains authoritative. Predictive Back cancellation
  leaves the selected tab and its history unchanged; a completed Back commits
  exactly one pop.
- Preserve the existing state ownership for search/map, inbox and circles
  content during this slice. Navigation 3 entry state should retain the
  relevant tab content through tab changes and activity recreation where the
  current app promises continuity.
- Restore only safe tab-visit keys after `TrustrootsApp` has loaded the live
  authenticated session. Session restoration remains owned by
  `TrustrootsApp` and `SecureMobileSessionStore`; a missing or invalid live
  session must not be reconstructed from navigation state.

## Risks and mitigations

- Navigation 3 Back handling could compete with existing `BackHandler`s.
  Keep nested screens' handlers authoritative and add journeys for tab origin,
  form leave confirmation, browser/menu Back and predictive cancellation.
- Tab changes can accidentally recreate screen state or break same-tab reset
  behaviour. Preserve reset semantics explicitly and cover search, inbox and
  circles tab journeys, including activity recreation.
- Android saved state may contain only keys and ordinary UI state. Tests and
  code review must ensure no session or account secrets are added to keys or
  navigation saved-state values.

## Dependency note

The selected stable Navigation 3 release is 1.2.0. Keep the existing Kotlin
2.3.21, Compose BOM 2026.06.00 and Lifecycle 2.10.0 versions. If the stable
runtime requires a serialization runtime/plugin for `@Serializable` keys, add
the matching Kotlin serialization plugin at 2.3.21 and the compatible stable
runtime only; avoid alpha helpers or unrelated version upgrades. Use the
Lifecycle 2.10.0 `lifecycle-viewmodel-navigation3` decorator together with
Navigation 3's saveable-state decorator so entries have correct state and
ViewModel ownership for future screen ViewModels.
