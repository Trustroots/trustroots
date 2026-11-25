## Why

Direct messages can lose line breaks when a draft is sent, viewed on another
client or included in an unread-message email. Inbox excerpts can join words
from adjacent paragraphs.

## What Changes

- Preserve line breaks and interior blank lines across direct-message drafts,
  conversations and unread-message emails.
- Use a shared line-preserving plain-text representation for native message
  bodies and keep inbox excerpts readable on one line.
- Enable multiline direct-message composition on iPhone.

## Impact

Affected areas include web messaging, native messaging and unread-message email.
The existing HTML API field remains available and stored records require no
migration.
