## Why

Members who link a public Nostr key should be able to post in Circle chat with their Trustroots account. The current Radio and chat flows can prompt for browser-extension permissions on entry.

## What Changes

- Use the existing Trustroots service signer for all posts from the four web chat rooms.
- Show the composer to signed-in members and give message loading and sending their own recovery states.
- Make Radio's public relay connection read-only and store favourites locally.

## Capabilities

### Modified Capabilities

- `mixed-circle-chat`: Use the server signer for web posts regardless of linked keys.
- `radio-circle`: Retain playback, local favourites and incoming listener activity without extension signing.
- `volunteering-chat`: Describe the shared server signing flow for volunteering posts.
- `hackers-chat`: Describe the shared server signing flow for Hackers posts.
