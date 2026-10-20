# Design

## File ownership

Move screen entry points and their screen-specific helpers into feature
packages under `org.trustroots.android.ui`:

| Source responsibility                                                              | Destination                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Host offer screen from `HostAndAccountScreens.kt`                                  | `ui/hostoffer/HostOfferScreen.kt`                                         |
| Experience creation screen                                                         | `ui/experience/CreateExperienceScreen.kt`                                 |
| Account settings and APK update settings                                           | `ui/account/AccountSettingsScreen.kt`, `ui/account/ApkUpdateSettings.kt`  |
| Circles screen                                                                     | `ui/circles`                                                              |
| Host map and result card                                                           | `ui/hostmap`, with substantial helpers split into focused files as useful |
| Search hub and search mode menu                                                    | `ui/search`                                                               |
| Startup screen                                                                     | `ui/startup`                                                              |
| Menu screen, menu link and `infoAndSupportIcon`                                    | `ui/menu`                                                                 |
| Member navigation bar                                                              | `ui/common`                                                               |
| Usage analytics settings, shared navigation links, and shared pure-data UI helpers | `ui/common` where they are genuinely shared                               |

Keep `TrustrootsApp`, the member shell coordinator, and `Destination` in the
`ui` root. Existing `profile`, `inbox`, `conversation`, `contacts`,
`editprofile`, `membersearch`, `signin`, and `theme` packages retain ownership
of their current screens.

## Imports and visibility

Update production and test imports, test source packages, and test references
to follow the new package ownership. Keep declarations internal or public only
where existing production callers or tests require access. Do not retain old
screen functions as forwarding declarations in former files. Keep the shell
as the composition and navigation boundary; screen packages may expose their
entry points to it without moving shell coordination into feature packages.

No resources, ViewModels, navigation state, screen state, presentation,
formatting, or runtime behaviour are part of the moves. Any pending branch
changes to circles descriptions, collapsing headers, or profile actions must
be integrated against the moved files when those branches are brought forward.

## Follow-up branch integration

The current source base does not include the pending `CirclesDescription`,
collapsing-header, and profile-action changes. Reconcile those changes with
the new file paths when integrating their branches; they are outside this
source-only change.
