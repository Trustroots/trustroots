# Design

## Ownership boundary

The implementation is now organised under the feature packages below.
`TrustrootsApp.kt`, `Destination`,
`MemberTabVisit`, `MemberShellVisit` and the `MemberShell` coordinator in the
`ui` root remain in place. `TrustrootsApp` remains responsible for startup, sign-in, shell and
navigation composition; it does not own screen bodies. Do not introduce a
second navigation owner, synthetic ViewModel owner, forwarding function or
compatibility alias.

| Feature responsibility                                                                       | Implemented location          |
| -------------------------------------------------------------------------------------------- | ----------------------------- |
| Circles overview/detail routes, screens, ViewModels, description, failure and colour helpers | `ui/circles/`                 |
| Host detail screen and ViewModel                                                             | `ui/hostdetail/`              |
| Host map screen, ViewModel, result card and map-only helpers                                 | `ui/hostmap/`                 |
| Host offer screen and ViewModel                                                              | `ui/hostoffer/`               |
| Account screen, ViewModel and APK update settings                                            | `ui/account/`                 |
| Experience screen and ViewModel                                                              | `ui/experience/`              |
| Menu screen, display and links                                                               | `ui/menu/`                    |
| Search hub and route types                                                                   | `ui/search/`                  |
| Startup screen                                                                               | `ui/startup/StartupScreen.kt` |
| Build date, navigation bar, shared navigation links and analytics settings                   | `ui/common/`                  |
| Shell coordination and persisted top-level routes                                            | `ui/TrustrootsApp.kt`         |

`HostAndAccountScreens.kt` and the other former root-level screen files have
been removed. Feature ViewModel unit tests live beside their feature packages;
the established Android journey suite remains under `ui` with explicit feature
imports to preserve its existing fixtures and test names.

Existing `ui/account/AccountSettingsScreen.kt` and
`AccountSettingsViewModel.kt`, plus `profile`, `inbox`, `conversation`,
`contacts`, `editprofile`, `membersearch`, `signin`, `theme` and established
`ui/common` files, retain their current ownership. In particular, do not move
`MemberShellViewModelStoreOwner`; its current account-graph lifecycle is
independent of file ownership.

## Imports, visibility and tests

Set each moved declaration's package to match its destination and update all
production, unit-test and instrumentation-test imports. Feature ViewModel unit
tests live with their feature package. Established Android screen and
cross-feature journeys remain in their journey package and use explicit
imports, with Navigation 3 entry ownership where required. Preserve each
declaration's required visibility, route serialization, Navigation 3 entry
decorators, ViewModelStoreOwner, ViewModel key and lifetime, callbacks,
resource references and test fixture. Use explicit imports; do not use aliases
to hide ownership changes.

The four already-persisted Menu keys (`MenuPageVisit`, `MenuBrowserVisit`,
`MenuPage`, and `MenuBrowserDestination`) keep package
`org.trustroots.android.ui` inside the physically organised
`ui/menu/MenuRouteKeys.kt` file. Navigation 3 writes each key's Java class name
to saved state and resolves it with `Class.forName` when restoring, so changing
these package names would invalidate saved stacks from an earlier app version.
The new `MenuMemberProfileVisit` and `MenuEditProfileVisit` route keys live in
`org.trustroots.android.ui.menu` in `ui/menu/MenuNavigation.kt`.
Do not substitute `@SerialName`: it does not change the Java class name used by
Navigation 3's SavedState serializer.

The move preserves the integrated implementations, routes, entry-owned
ViewModels, callbacks, resources and existing journey assertions. Keep all test
methods, assertions and resource names and maintain current test counts.

## Validation

Source references were reconciled across production, `src/test` and
`src/androidTest`; aggregate files and stale imports were removed. Android
production compilation, unit tests, lint, debug assembly, device tests and
repository checks have passed. `MenuNavigationRouteTest` adds a Navigation 3
SavedState round-trip regression; all four route tests passed, including
legacy EditProfile and omitted support-link values.
The living specification has been updated, strict validation passed, and the
completed change is archived.
