# Design: Hybrid Angular and React route ownership

## Context

The application already contains React page components mounted from Angular.
Replacing Angular globally would combine many unrelated member workflows in
one high-risk change. A route-owned shell allows migration in bounded groups.

## Decisions

### Shared route policy

A framework-neutral route policy is the single source of truth for React-owned
paths, titles, footer variants, redirects, and access requirements. Express
uses it to choose the initial document and enforce direct-load access. The
React client uses the same policy to render and guard navigation.

### Separate bundles and roots

Webpack emits `main` for Angular-owned routes and `react-main` for React-owned
routes. Express renders the matching root and asset list, so only one
application boots for a direct page load.

### Compatibility during migration

Angular remains responsible for member workflows. Navigation between
framework-owned route groups uses full-page navigation where necessary, while
same-shell links can use client-side history.

## Excluded

This change does not migrate circles, profiles, search, offers, messaging, or
authentication. Those flows need separate proposals because they carry
substantial state, privacy, and redirect behaviour.
