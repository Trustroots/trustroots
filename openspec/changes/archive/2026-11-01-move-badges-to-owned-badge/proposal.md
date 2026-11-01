## Why

The web client draws its badges four different ways: Bootstrap's `.badge`
restyled by context in `nav.less` and `navbar.less`, a `notification-badge`
Less directive, a `profile-nostr-badge` rule, and a styled-components dot. The
owned `Badge` primitive exists but nothing in the app uses it. Each new badge
copies one of these and adds more context-dependent Less.

## What Changes

- The owned `Badge` describes its appearance with `variant` (solid, outline),
  `tone`, `size` and `shape`, plus an `indicator` dot, and exposes them as
  `data-*` attributes. Only values that a consumer uses are offered.
- The profile tab counts, the mobile profile navigation counts, the unread
  messages counter and the Nostroots badge use it.
- The badge Less (`badge.less`, `notification-badge.less` and the `.badge`,
  `.link-badge` and `.profile-nostr-badge` rules) and the core `Badge`
  wrapper are removed.

## Impact

Badges keep their appearance in LTR and RTL, checked pixel by pixel against
main on every page that shows one. The Nostroots badge loses an 8px indent so
it lines up with the rest of the profile sidebar. No API or database change is
required.
