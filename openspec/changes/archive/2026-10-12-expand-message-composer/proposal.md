## Why

The message editor stops growing at 250px on desktop and 100px on mobile, forcing members to scroll through even moderately long drafts. Its writing area cannot be enlarged manually.

## What Changes

- Add an accessible Expand / Collapse control to the opening-message and reply composer.
- Expanded mode uses the available conversation area on desktop and mobile, including when the virtual keyboard changes the available space.
- Preserve draft content, preview and sending behaviour across size changes; keep actions visible and scroll only when a draft exceeds the expanded area.

## Impact

- Messaging composer, styles, English translation keys and regression coverage.
- No API or database changes.
