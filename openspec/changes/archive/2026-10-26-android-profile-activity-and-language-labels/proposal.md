## Why

Android profile pages omit the public last-seen information already displayed
on the website, and some registered language identifiers are shown as raw
codes when Android cannot derive a display name from its locale data.

## What changes

- Display a profile's existing public `seen` timestamp as a localised relative
  last-seen label, showing the existing long-ago fallback when absent and an
  unavailable status when malformed.
- Resolve ISO-prefixed language identifiers to their language codes and show
  Mandinka by name for `mnk`.
- Keep biography, hosting and circles in their existing order.

## Capabilities

### Modified

- `native-android-member-app`: show profile activity and readable language
  names in the existing native profile.

## Impact

This uses the existing public profile response and existing language codes.
No server or API changes are needed.
