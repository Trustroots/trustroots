# Collapse remaining Android screen headers

## Why

Several Android member screens reserve substantial vertical space for fixed
headers. On short phones, this reduces the space available for contacts,
account settings and profile content. Collapsing those headers as their content
scrolls will make the screens more usable while keeping navigation and key
actions available.

## What changes

- Add collapsing header behaviour to the Profile destination, Contacts overview
  and Account screen.
- Make the own-profile and member-profile artwork headers collapse with their
  scrollable content while keeping the profile actions and section tabs usable.
- Preserve profile artwork behind the action area and tabs, existing Back,
  message and overflow actions, and system inset handling.
- Keep profile section tabs fixed outside the pager; only the selected section
  content scrolls independently.

## Capabilities

### Modified capabilities

- `native-android-member-app`: compact, scroll-responsive headers on remaining
  member destinations, with existing navigation and content behaviour intact.

## Impact

Changes are limited to Compose presentation in `apps/android` and native UI
tests. No server, web, API, data migration or deployment changes are needed.
