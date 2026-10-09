# Focus the message composer on desktop

## Why

Members need an extra click before typing in an opened conversation. After a
message is sent, the reply editor is recreated and can lose the focus requested
by the conversation component. This slows down consecutive replies.

## What changes

- Focus the reply editor when it appears on desktop.
- Focus the newly created reply editor after a successful send.
- Keep initial mobile focus unchanged to avoid opening the on-screen keyboard.

## Impact

The change affects only the web conversation composer. The messaging API and
stored messages do not change.
