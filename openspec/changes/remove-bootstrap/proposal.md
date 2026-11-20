## Why

The web client still loads Bootstrap for its reset, forms, responsive layouts and
legacy component classes. Shared UI components and prefixed Tailwind utilities
already cover the migrated surfaces. Removing Bootstrap completes #3248.

## What Changes

- Migrate form controls to owned UI components and prefixed Tailwind utilities.
- Migrate responsive layout and remaining component classes to owned styles.
- Remove the Bootstrap stylesheet import, Less compatibility shim and package.
- Verify the production build and representative desktop, mobile and RTL flows.

## Impact

- Affected code includes web features in modules, the React shell, the shared UI
  package and the Vite style entries.
- The change preserves existing presentation, semantics and keyboard behaviour.
  It requires no API, stored data or deployment changes.
- Email templates and map rendering are outside the migration.
