# Change: render supported circle description formatting on Android

## Why

The Android circle detail currently converts the API description to a plain
string, which drops inline emphasis and rich-text structure. The website renders
circle descriptions through the shared sanitised `RichText` component, so the
native detail should present the same supported formatting.

## What Changes

- Render the supported rich-text structure in native Android circle details:
  paragraphs, line breaks, unordered lists, emphasis, underlining, blockquotes,
  and linked text labels.
- Keep user-written links non-clickable, matching the website presentation.
- Keep circle filtering based on the visible description text.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: render supported rich-text formatting in circle
  details.

## Impact

- Affects the Android circle detail presentation and its tests.
- Uses the existing circle description API field; no server, database, web, or
  iOS behaviour changes.
- Adds no dependency or persistent data migration.
