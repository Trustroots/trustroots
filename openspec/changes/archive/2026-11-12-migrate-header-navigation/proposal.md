## Why

The site header still uses React Bootstrap for its navigation wrappers and
the Support and Profile dropdowns. Moving them to owned markup and a shared
disclosure advances issue #3248.

## What Changes

- Replace the React Bootstrap Navbar, Brand and Nav wrappers with HTML.
- Use Base UI popovers for the Support and Profile dropdowns, preserving their
  desktop placement, links, pointer and keyboard access, and navigation analytics.
- Keep the desktop Circles and Search shortcuts and the separate mobile menu.

## Impact

Applies to the shared web header. Existing Bootstrap layout and menu styles
continue to load during the CSS migration. No API or database change is required.
