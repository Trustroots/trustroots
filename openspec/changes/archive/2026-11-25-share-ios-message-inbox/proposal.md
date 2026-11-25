# Share the regular iOS Messages inbox

## Why

The Compose pilot inbox has a simpler layout than the Android inbox. Reusing
Android-style conversation rows in the regular iOS app moves the next member
screen to Compose while using the existing iOS message and cache logic.

## What changes

- Add tappable shared rows with avatars, excerpts, timestamps and unread state.
- Present the Compose inbox in the regular iOS Messages tab.
- Keep the iOS filtering, pagination, offline cache, navigation and reply code.
- Reload unread state when a member returns from a conversation.
