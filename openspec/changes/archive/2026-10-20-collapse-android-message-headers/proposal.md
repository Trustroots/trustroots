## Why

The Android Messages overview and conversation detail currently keep their
large title content in fixed columns. Scrolling the inbox or conversation body
does not collapse these headers, leaving less room for messages and making the
screens feel different from the other native member screens. Issue #3234 calls
for the remaining member headers to collapse consistently.

## What Changes

- Give the Messages overview and conversation detail Material 3 large app bars
  that collapse to a single title row while their content scrolls.
- Share the app bar implementation through `ui/common/MemberLargeTopAppBar`,
  with title and optional back action support, and use the existing native
  Circles app bar as the visual and scroll-behaviour reference.
- Keep the overview filter in its current live, locally filtered flow and keep
  profile actions on inbox rows available across the full row.
- Preserve conversation navigation, profile origins, drafts, reply actions,
  message scroll behaviour, pagination, accessibility, keyboard handling and
  supplied insets while moving content under the collapsing bars.
- Use the established Material title typography in both expanded and collapsed
  states, with the collapsed state occupying one app-bar row.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify collapsing, consistent message headers
  and their required interaction and layout behaviour.

## Impact

- Affects `apps/android` presentation code in the inbox, conversation and
  `ui/common` packages, plus Android journey coverage and the native Android
  living specification.
- Adds no module dependencies, API changes, data migrations or server changes.
- Existing saved drafts and navigation destinations remain compatible.
