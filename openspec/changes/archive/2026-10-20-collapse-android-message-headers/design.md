## Context

The overview currently renders its “Messages” title and live filter in a fixed
column above a separately scrolling `LazyColumn`. Conversation detail renders
its back action and participant identity in a fixed column above the separately
scrolling message history. Neither header participates in nested scrolling.
The Circles screen already uses Material 3 `LargeTopAppBar` with
`exitUntilCollapsedScrollBehavior` and supplies the closest in-app pattern.

## Design

Add a reusable `MemberLargeTopAppBar` in `ui/common`, based on Material 3
`LargeTopAppBar`. It accepts a title, a `TopAppBarScrollBehavior`, content
insets, and an optional back callback. It uses the standard headline title
styles, ellipsis for long names, surface colours from the app theme, and an
accessible 48 dp back action. The overview and conversation each remember an
`exitUntilCollapsedScrollBehavior`, attach its nested-scroll connection to the
screen scaffold, and share it between their app bar and scrolling content.

The inbox title moves to the app bar. Its filter, loading/error feedback and
empty state move into the first `LazyColumn` item so they scroll with the
conversation rows. This keeps the existing filter state and matching rules,
while allowing the list to drive app-bar collapse. Inbox row click targets and
the separate Profile action stay intact.

Conversation detail moves the participant title and Back action into the
shared app bar. The existing message history remains the primary vertical
scrolling region; it receives the nested-scroll connection while the quick
reply controls and composer remain fixed above the keyboard. The draft store,
send callbacks, quick replies, message order and scroll state remain attached
to the same participant identity. The title itself remains a profile-origin
independent header; “View profile” remains an explicit action where it exists.

The outer screen scaffolds must honour supplied `contentPadding`: top padding
is consumed by the app bar window insets, horizontal padding is applied to its
content, and bottom padding is retained for navigation. Conversation detail
continues to apply IME padding to the whole usable screen. No model or API
changes are needed.

## Validation

Before implementation, run the new anonymous-fixture journeys on the existing
screens and capture expanded and scrolled screenshots plus title/filter/message
bounds. Those establish the current tall fixed-header behaviour. After the
parent agent authorises implementation, verify the same journeys show one-row
collapsed titles during body scrolling and preserve the existing message and
navigation interactions.
