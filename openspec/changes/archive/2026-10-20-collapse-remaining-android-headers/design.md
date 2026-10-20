# Design: Collapse remaining Android screen headers

## Context

Issue 3234 tracks a coordinated pass over tall Android headers. The Circles
screen and profile action chrome are being handled in separate small slices;
this change covers the Profile destination, Contacts, Account, and own/member
profile details.
Current screens mix fixed title rows, scrollable whole-screen content, and a
profile frame whose artwork and controls are already separated from its pager.

## Goals

- Give scrollable content more vertical room after the member scrolls.
- Keep Back and high-value profile actions accessible during scrolling.
- Preserve the recognisable profile artwork frame and synchronised tabs.
- Respect caller-provided top and bottom insets on compact and gesture-nav
  screens.
- Use baseline Compose tests and anonymous fixtures before changing production
  UI.

## Decisions

- Use Compose nested-scroll/collapsing behaviour within each screen's existing
  scroll owner; do not introduce another navigation layer or change screen
  destinations.
- The Profile destination, Contacts and Account retain their current content
  order and API state. Their title and navigation controls compact as their
  content scrolls.
- Own and member profiles share one collapsing frame. The artwork continues
  behind the status inset and action area; Back remains on the left, Send a
  message remains the primary action for another member, and overflow/edit
  actions retain their current availability. In the collapsed state, the
  action row contains Back, one ellipsised member title, and the existing
  actions; the fixed section tabs sit immediately beneath it. The expanded
  avatar/name block collapses away instead of leaving a second title row.
  Expanded and compact profile titles use Material 3 large-app-bar typography.
- The bottom-navigation Profile destination keeps a compact `Profile` title
  app bar while the member identity block and destination links remain in the
  scrollable content below it.
- Keep profile section tabs outside `HorizontalPager`. Tabs remain over the
  artwork and stay visible as section content scrolls; pager swipes and tab
  selection continue to select the same section.
- Establish expanded and scrolled screenshot/bounds baselines using anonymous
  test data before changing production layout. Existing profile frame journey
  assertions remain in force and will be extended for collapsing states.
- Keep the implementation on the repository's pinned Compose BOM; validate
  the required nested-scroll/app-bar APIs against that pinned version before
  production implementation. Do not upgrade dependencies as part of this work.

## Risks

- Nested scroll ownership can cause profile section content or Account forms to
  consume gestures before the outer header. Tests must prove the intended
  collapse order and preserve independent profile pager scrolling.
- Applying top inset twice can push the artwork below the status bar or clip
  actions. Verify explicit top and bottom inset cases.
- A collapsing frame must not move the action hit targets under system bars or
  obscure the message/edit/menu controls on short screens.

## Rollout

No server migration is required. Ship with the normal Android app release
process; reverting the Android UI commit restores the existing headers.
