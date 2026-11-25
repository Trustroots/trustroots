# Share iOS Circles discovery with Compose

## Why

The regular iOS app renders its Circles discovery list separately from the
shared Compose UI used for other member screens.

## What changes

- Render the regular iOS Circles catalog, text filter and membership controls
  in shared Compose.
- Use the existing native session, server catalog, membership and artwork
  handling.
- Continue to open native circle details and the Trustroots Wiki.
