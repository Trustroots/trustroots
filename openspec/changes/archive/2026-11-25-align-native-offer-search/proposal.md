# Align native offer search

## Why

The iOS map exposes fewer offer filters than the web and Android. People need
to narrow the same offers when using a map or a textual results list.

## What changes

- Add iOS map and results modes with a common filtered viewport, place search
  and offer selection.
- Add offers to meet, languages and activity choices to the iOS filter sheet.
- Send volunteering and connections-only filters through the existing offer
  API on Android and iOS.
