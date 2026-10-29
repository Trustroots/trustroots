## Why

Issue #3248 calls for incremental migration to owned UI components. The existing
design-token bridge provides shared values; the next slice needs an isolated
utility pipeline that can coexist with Bootstrap without changing current pages.

## What Changes

- Integrate Tailwind into the web Vite build with prefixed utilities and no
  Preflight reset, using the existing design tokens for the brand theme.
- Verify generated utilities in development and production, including RTL, and
  preserve existing Bootstrap styling. Document how to use the utilities.
- Keep component migration and removal of Bootstrap for later slices.

## Impact

This changes the web client build and adds development dependencies. It does not
change server behaviour, introduce a module dependency or redesign the site.
