# Share regular iOS conversations

## Why

The regular iOS inbox uses Compose. Move the conversation body and reply
composer to Compose while keeping the iOS member actions and session.

## What changes

- Reuse the shared message bubble and show recent history, loading, and errors.
- Keep profile navigation, read tracking and Experience actions in the iOS host.
- Use the protected draft store in regular conversations, including when a
  send fails or the app relaunches.
