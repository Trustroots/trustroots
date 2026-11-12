## Why

The header uses owned navigation components but still depends on Bootstrap
navbar and dropdown classes. Replacing those classes advances issue #3248
without changing the site's shared responsive grid.

## What Changes

- Style the fixed header and its navigation lists with site-owned selectors.
- Use shared Tailwind styles for the Support and Profile panels and the
  Circles and Search shortcut lists.
- Preserve the existing green header, active links, focus and pointer
  behaviour, responsive visibility and right-to-left placement.
- Keep the profile dropdown compact by allowing the information links to
  wrap, and remove its Foundation and Media links.

## Impact

The change is limited to the site header and shared navigation dropdown.
No API, database or dependency changes are required.
