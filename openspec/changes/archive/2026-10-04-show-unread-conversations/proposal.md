# Show unread conversations in the inbox

## Why

The unread badge counts all unread conversations, but the inbox initially lists
only the 20 most recently updated conversations. Older unread conversations can
therefore be difficult to find. [Issue #2975](https://github.com/Trustroots/trustroots/issues/2975)
also requests a conversation filter on the website.

## What changes

- Add an unread-only inbox view, using the same eligibility rules as the unread
  count.
- Let members switch between all conversations and unread conversations.
- Let members filter conversations by the other member's name or username and
  the latest message preview, including conversations on older inbox pages.
- Preserve pagination within each view.

## Impact

The messaging API accepts an optional `filter=unread` query parameter. The web
inbox gains unread and text filter controls. Message visibility and stored
messages do not change. No data migration or deployment change is required.
