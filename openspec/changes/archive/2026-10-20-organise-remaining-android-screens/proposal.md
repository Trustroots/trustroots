# Organise the remaining Android member screens

## Why

The first source-organisation slice placed member search, profile, inbox,
conversation and contacts in feature packages. The current integrated Android
shell now also has Navigation 3 route owners and entry-owned ViewModels, while
several other screen bodies and feature-specific helpers still live in the
`ui` root. Completing the package ownership map will make the existing
feature boundaries clear without changing how routes, state or screens work.

## What Changes

- Move the remaining Circles, HostDetail, HostMap, HostOffer, Search, Account,
  Experience, Menu and Startup screen sources into their established feature
  packages, together with their current ViewModels, route keys and screen-only
  helpers.
- Move `MemberNavigationBar`, `SharedNavigationLinks`, `UsageAnalyticsSettings`
  and build-date helpers into `ui/common`; keep `TrustrootsApp`, `Destination`,
  `MemberTabVisit`, `MemberShellVisit` and the `MemberShell` coordinator in
  the `ui` root.
- Update imports and test packages to match source ownership. Keep
  cross-feature journeys in their existing UI journey package and retain
  direct-screen tests with the feature they exercise.
- Remove old source files after moving their current integrated declarations;
  do not add forwarding declarations or compatibility aliases.

## Behaviour and Compatibility

This is a source-only, behaviour-preserving organisation change. Existing
rendering, navigation, route keys, state and ViewModel owners, callbacks,
resources, API calls, test assertions and test counts remain unchanged. There
are no Android API, server, data, deployment, dependency or user-facing
behaviour changes.

Navigation 3's persisted route type identity is the Java class name. The four
existing Menu route keys therefore retain their original
`org.trustroots.android.ui` package even though their source file lives under
`ui/menu`; source organisation must not change persisted route class names.

## Impact

Only Android Kotlin source and test file/package organisation and this
specification are affected. The web and iOS applications are unaffected.
