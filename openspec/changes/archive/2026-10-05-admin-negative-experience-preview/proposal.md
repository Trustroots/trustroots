# Admin negative-experience feedback preview

## Why

The administration dashboard lists recent negative experiences but currently
shows only participants and dates. Administrators need to inspect the public
feedback that explains each negative recommendation without leaving the
dashboard.

## What changes

- Add an accessible preview for public feedback in each negative-experience
  date cell.
- Show the full feedback text with line breaks when the date is hovered,
  focused, or activated by touch.
- Keep previews available to keyboard and screen-reader users, support Escape
  dismissal, and provide a clear fallback when feedback is unavailable.

## Capabilities

### New capabilities

- `admin-negative-experience-preview`: Display public negative-experience
  feedback in a responsive, accessible dashboard preview.

### Modified capabilities

- `admin-moderation`: Extend the administration dashboard's negative-experience
  list with an inline feedback preview.

## Impact

- Admin dashboard client rendering and its API response type.
- Client and end-to-end tests for the preview interaction.
