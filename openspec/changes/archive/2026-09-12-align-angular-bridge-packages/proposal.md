# Align Angular bridge packages

## Why

The application still renders Angular pages alongside extracted React routes. Keep that bridge on a consistent Angular release while preserving forms, navigation and embedded React components.

## What Changes

- Align the Angular core and companion packages on 1.8.3.
- Preserve account subscription error messages with the existing message service.
- Keep isolated title-directive tests independent of URL navigation.
- Retain the Node 16, React 17 and Webpack 4 baseline.

## Impact

- Affected spec: site-presentation.
- Affected code: package manifests, account message handling and client test fixtures.
- Existing Angular and React routes retain their access rules and destinations.
