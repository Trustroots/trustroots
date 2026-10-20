# Organise the remaining Android screens

## Why

The Android Compose UI has grown beyond the initial set of screens, while a
number of unrelated screens and shared helpers still live together in the
`ui` root. Organising those files by feature will make ownership clearer and
keep future screen work local to its feature.

## What Changes

- Split `HostAndAccountScreens.kt` into `ui/hostoffer/HostOfferScreen.kt`,
  `ui/experience/CreateExperienceScreen.kt`,
  `ui/account/AccountSettingsScreen.kt` and `ui/account/ApkUpdateSettings.kt`.
- Move `CirclesScreen` into `ui/circles`.
- Move `HostMapScreen` and `HostResultCard` into `ui/hostmap`, splitting major
  helpers into focused files where that improves organisation.
- Move `SearchHubScreen` and `SearchModeMenu` into `ui/search`.
- Extract `StartupScreen` into `ui/startup` and `MenuScreen`, `MenuLink`, and
  `infoAndSupportIcon` into `ui/menu`.
- Move `MemberNavigationBar` into `ui/common`. Place
  `UsageAnalyticsSettings`, `SharedNavigationLinks` and existing pure-data
  helpers in `ui/common` when they are shared UI concerns.
- Keep `TrustrootsApp`, the member shell coordinator and the `Destination`
  enum in the `ui` root. Keep the established `profile`, `inbox`,
  `conversation`, `contacts`, `editprofile`, `membersearch`, `signin` and
  `theme` feature folders.
- Update production references, tests and test package declarations to match
  the new owners. Preserve visibility needed by tests and remove old screen
  implementations rather than leaving forwarding functions in their former
  files.

## Behaviour and Compatibility

This is a behaviour-preserving source organisation change. Screen rendering,
navigation, state ownership, ViewModels, resources and runtime behaviour remain
unchanged. The change introduces no new user-facing functionality and does not
alter Android app APIs.

The implementation starts from the current SignIn destination module in
`ui/signin`. Other branches contain `CirclesDescription`, collapsing-header
and profile-action changes that are not in this base. Those changes remain
pending integration; when integrating them, resolve any file moves and
renames against the new feature folders.

## Validation

Review the resulting package and import ownership, and run the existing
Android compilation and relevant unit tests after implementation. No new
behaviour-specific tests are needed for a source-only refactor; existing tests
should be moved or updated where package paths change.

## Impact

Affected area: Android UI source organisation under `apps/android`. There are
no changes to product behaviour, server contracts, persisted data, or other
platforms.
